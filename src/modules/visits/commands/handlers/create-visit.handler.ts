import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  ServiceOrderSource,
  ServiceOrderStatus,
  ServiceOrderType,
  type CustomerType,
} from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import {
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { AttachmentUploadService } from '../../../attachments/attachment-upload.service';
import type { PreparedPendingAttachment } from '../../../attachments/attachments.types';
import { AttachmentsRepository } from '../../../attachments/infrastructure/attachments.repository';
import { CustomerEmailLookupService } from '../../../customers/customer-email-lookup.service';
import { buildCustomerPii } from '../../../customers/customers.mapper';
import { CustomersReadRepository } from '../../../customers/infrastructure/customers.read-repository';
import { CustomersRepository } from '../../../customers/infrastructure/customers.repository';
import {
  calculateWarrantyUntil,
  parseDeviceDate,
} from '../../../devices/devices.mapper';
import type { StoredDevice } from '../../../devices/devices.types';
import { DevicesReadRepository } from '../../../devices/infrastructure/devices.read-repository';
import { DevicesRepository } from '../../../devices/infrastructure/devices.repository';
import { TenantPiiCipherService } from '../../../tenant-encryption/tenant-pii-cipher.service';
import type { CreateVisitDeviceDataDto } from '../../dto/create-visit.dto';
import type { CreateVisitResultDto } from '../../dto/visit-response.dto';
import {
  VisitsRepository,
  type VisitsTransactionClient,
} from '../../infrastructure/visits.repository';
import { VisitsMapper } from '../../visits.mapper';
import type {
  StoredVisit,
  StoredVisitCustomer,
  StoredVisitServiceOrder,
} from '../../visits.types';
import { CreateVisitCommand } from '../impl/create-visit.command';
import {
  arraysEqual,
  deriveCommandUuid,
  ensureUniqueClientFileIds,
  ensureUniqueVisitDeviceIds,
  fingerprintCustomer,
  fingerprintDevice,
  isUniqueConstraintError,
  normalizeAndValidateAddress,
  throwCustomerEmailAlreadyExists,
  throwCustomerNotFound,
  throwDeviceCustomerMismatch,
  throwDeviceNotFound,
  throwIdempotencyKeyReused,
  throwInvalidInstallationDate,
  throwServiceOrderCustomerMismatch,
  throwServiceOrderNotFound,
} from './create-visit.utils';

type PreparedVisitAttachment = PreparedPendingAttachment & {
  readonly clientFileId: string;
};

type PreparedNewCustomer = {
  readonly id: string;
  readonly type: CustomerType;
  readonly encryptedPii: Awaited<
    ReturnType<TenantPiiCipherService['encryptJson']>
  >;
  readonly emailLookup: ReturnType<CustomerEmailLookupService['create']>;
};

type PreparedDevice =
  | {
      readonly kind: 'existing';
      readonly id: string;
      readonly visitNote: string;
    }
  | {
      readonly kind: 'create';
      readonly id: string;
      readonly visitNote: string;
      readonly input: CreateVisitDeviceDataDto;
      readonly installationDate: Date | null;
      readonly warrantyUntil: Date | null;
      readonly encryptedInstallationAddress: Awaited<
        ReturnType<TenantPiiCipherService['encryptJson']>
      > | null;
    };

type TransactionResult = {
  readonly visit: StoredVisit;
  readonly completedServiceOrder: StoredVisitServiceOrder | null;
  readonly nextInspectionServiceOrder: StoredVisitServiceOrder | null;
};

@CommandHandler(CreateVisitCommand)
export class CreateVisitHandler implements ICommandHandler<
  CreateVisitCommand,
  ApiSuccessResponse<CreateVisitResultDto>
> {
  constructor(
    private readonly repository: VisitsRepository,
    private readonly attachmentsRepository: AttachmentsRepository,
    private readonly customersRepository: CustomersRepository,
    private readonly customersReadRepository: CustomersReadRepository,
    private readonly devicesRepository: DevicesRepository,
    private readonly devicesReadRepository: DevicesReadRepository,
    private readonly mapper: VisitsMapper,
    private readonly piiCipher: TenantPiiCipherService,
    private readonly emailLookupService: CustomerEmailLookupService,
    private readonly attachmentUploadService: AttachmentUploadService,
  ) {}

  async execute(
    command: CreateVisitCommand,
  ): Promise<ApiSuccessResponse<CreateVisitResultDto>> {
    const customerId =
      command.dto.customer.kind === 'existing'
        ? command.dto.customer.customerId
        : deriveCommandUuid(
            command,
            `customer:${fingerprintCustomer(command.dto.customer.customer)}`,
          );
    const preparedCustomer = await this.prepareCustomer(command, customerId);
    const preparedDevices = await this.prepareDevices(command);
    ensureUniqueVisitDeviceIds(preparedDevices);

    ensureUniqueClientFileIds(command.dto.attachments);
    const pendingAttachments =
      this.attachmentUploadService.preparePendingAttachments({
        tenantId: command.tenantId,
        files: command.dto.attachments.map((attachment) => ({
          ...attachment,
          id: deriveCommandUuid(
            command,
            `attachment:${attachment.clientFileId}`,
          ),
        })),
      });
    const preparedAttachments: PreparedVisitAttachment[] =
      pendingAttachments.map((attachment, index) => ({
        ...attachment,
        clientFileId: command.dto.attachments[index].clientFileId,
      }));

    let result: TransactionResult;

    try {
      result = await this.repository.transaction((transaction) =>
        this.persist(
          command,
          transaction,
          customerId,
          preparedCustomer,
          preparedDevices,
          preparedAttachments,
        ),
      );
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const replay = await this.loadReplay(
        command,
        customerId,
        preparedDevices,
        preparedAttachments,
      );

      if (!replay) {
        throwCustomerEmailAlreadyExists();
      }

      result = replay;
    }

    const uploadForms = await this.attachmentUploadService.createUploadForms(
      result.visit.attachments,
    );
    const uploads = result.visit.attachments.map((attachment, index) => {
      const clientAttachment = preparedAttachments[index];

      if (!clientAttachment || clientAttachment.id !== attachment.id) {
        throwIdempotencyKeyReused();
      }

      const upload = uploadForms[index];

      return {
        clientFileId: clientAttachment.clientFileId,
        attachment: this.mapper.mapPendingAttachment(attachment),
        upload: {
          method: upload.method,
          url: upload.url,
          fields: upload.fields,
          expiresAt: upload.expiresAt.toISOString(),
        },
      };
    });
    const visit = await this.mapper.mapVisit(result.visit, this.piiCipher);

    const completedServiceOrder = result.completedServiceOrder
      ? {
          ...this.mapper.mapServiceOrder(result.completedServiceOrder),
          status: ServiceOrderStatus.completed,
        }
      : null;
    const nextInspectionServiceOrder = result.nextInspectionServiceOrder
      ? {
          ...this.mapper.mapServiceOrder(result.nextInspectionServiceOrder),
          type: ServiceOrderType.inspection,
          source: ServiceOrderSource.system,
          status: ServiceOrderStatus.new,
        }
      : null;

    return apiSuccess({
      visit: {
        ...visit,
        attachments: result.visit.attachments.map((attachment) =>
          this.mapper.mapPendingAttachment(attachment),
        ),
      },
      completedServiceOrder,
      nextInspectionServiceOrder,
      attachmentUploads: uploads,
    });
  }

  private async prepareCustomer(
    command: CreateVisitCommand,
    customerId: string,
  ): Promise<PreparedNewCustomer | null> {
    if (command.dto.customer.kind === 'existing') {
      return null;
    }

    const pii = buildCustomerPii(command.dto.customer.customer);
    const emailLookup = this.emailLookupService.create(
      command.tenantId,
      pii.email,
    );
    const encryptedPii = await this.piiCipher.encryptJson({
      tenantId: command.tenantId,
      recordId: customerId,
      purpose: ENCRYPTION_PURPOSES.customerPii,
      value: pii,
    });

    return {
      id: customerId,
      type: command.dto.customer.customer.type,
      emailLookup,
      encryptedPii,
    };
  }

  private async prepareDevices(
    command: CreateVisitCommand,
  ): Promise<PreparedDevice[]> {
    return Promise.all(
      command.dto.devices.map(async (deviceCommand, index) => {
        if (deviceCommand.kind === 'existing') {
          return {
            kind: 'existing' as const,
            id: deviceCommand.deviceId,
            visitNote: deviceCommand.visitNote.trim(),
          };
        }

        const id = deriveCommandUuid(
          command,
          `device:${index}:${fingerprintDevice(deviceCommand.device)}`,
        );
        const input = deviceCommand.device;
        const installationDate = parseDeviceDate(input.installationDate);

        if (!installationDate && input.warrantyMonths > 0) {
          throwInvalidInstallationDate();
        }

        const customAddress = input.hasCustomInstallationAddress
          ? normalizeAndValidateAddress(input)
          : null;
        const encryptedInstallationAddress = customAddress
          ? await this.piiCipher.encryptJson({
              tenantId: command.tenantId,
              recordId: id,
              purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
              value: customAddress,
            })
          : null;

        return {
          kind: 'create' as const,
          id,
          visitNote: deviceCommand.visitNote.trim(),
          input,
          installationDate,
          warrantyUntil: calculateWarrantyUntil(
            installationDate,
            input.warrantyMonths,
          ),
          encryptedInstallationAddress,
        };
      }),
    );
  }

  private async persist(
    command: CreateVisitCommand,
    transaction: VisitsTransactionClient,
    customerId: string,
    preparedCustomer: PreparedNewCustomer | null,
    preparedDevices: readonly PreparedDevice[],
    preparedAttachments: readonly PreparedVisitAttachment[],
  ): Promise<TransactionResult> {
    const replay = await this.loadReplay(
      command,
      customerId,
      preparedDevices,
      preparedAttachments,
      transaction,
    );

    if (replay) {
      return replay;
    }

    const customer = await this.resolveCustomer(
      command,
      customerId,
      preparedCustomer,
      transaction,
    );
    const devices = await this.resolveDevices(
      command,
      customer.id,
      preparedDevices,
      transaction,
    );

    if (command.dto.serviceOrderId) {
      const serviceOrder = await this.repository.findServiceOrderForCompletion(
        command.tenantId,
        command.dto.serviceOrderId,
        transaction,
      );

      if (!serviceOrder) {
        throwServiceOrderNotFound();
      }

      if (
        serviceOrder.customerId !== null &&
        serviceOrder.customerId !== customer.id
      ) {
        throwServiceOrderCustomerMismatch();
      }
    }

    const visitWithoutAttachments = await this.repository.createVisit(
      {
        id: deriveCommandUuid(command, 'visit'),
        tenantId: command.tenantId,
        serviceOrderId: command.dto.serviceOrderId,
        customerId: customer.id,
        userId: command.userId,
        date: new Date(`${command.dto.performedOn}T00:00:00.000Z`),
        type: command.dto.type,
        devices: devices.map((device, sortOrder) => ({
          deviceId: device.id,
          note: preparedDevices[sortOrder].visitNote,
          sortOrder,
        })),
      },
      transaction,
    );
    const storedAttachments =
      await this.attachmentsRepository.createPendingMany(
        preparedAttachments.map((attachment, sortOrder) => ({
          ...attachment,
          owner: {
            kind: 'visit' as const,
            visitId: visitWithoutAttachments.id,
          },
          sortOrder,
        })),
        transaction,
      );
    const visit: StoredVisit = {
      ...visitWithoutAttachments,
      attachments: storedAttachments,
    };
    const completedServiceOrder = command.dto.serviceOrderId
      ? await this.repository.completeServiceOrder(
          command.tenantId,
          command.dto.serviceOrderId,
          transaction,
        )
      : null;
    const nextInspectionServiceOrder = command.dto.nextInspection
      ? await this.repository.createNextInspection(
          {
            id: deriveCommandUuid(command, 'next-inspection'),
            tenantId: command.tenantId,
            customerId: customer.id,
            customerType: customer.type,
            deviceIds: devices.map((device) => device.id),
            scheduledAt: new Date(command.dto.nextInspection.scheduledAt),
            now: new Date(),
          },
          transaction,
        )
      : null;

    return { visit, completedServiceOrder, nextInspectionServiceOrder };
  }

  private async resolveCustomer(
    command: CreateVisitCommand,
    customerId: string,
    prepared: PreparedNewCustomer | null,
    transaction: VisitsTransactionClient,
  ): Promise<Pick<StoredVisitCustomer, 'id' | 'type'>> {
    if (!prepared) {
      const customer = await this.customersReadRepository.findById(
        command.tenantId,
        customerId,
        transaction,
      );

      if (!customer) {
        throwCustomerNotFound();
      }

      return customer;
    }

    if (
      await this.customersRepository.hasEmailLookupHash(
        command.tenantId,
        prepared.emailLookup.hash,
        transaction,
      )
    ) {
      throwCustomerEmailAlreadyExists();
    }

    return this.customersRepository.create(
      {
        id: prepared.id,
        tenantId: command.tenantId,
        type: prepared.type,
        encryptedPii: prepared.encryptedPii,
        emailLookupHash: prepared.emailLookup.hash,
        emailLookupKeyVersion: prepared.emailLookup.keyVersion,
      },
      transaction,
    );
  }

  private async resolveDevices(
    command: CreateVisitCommand,
    customerId: string,
    preparedDevices: readonly PreparedDevice[],
    transaction: VisitsTransactionClient,
  ): Promise<StoredDevice[]> {
    const devices: StoredDevice[] = [];

    for (const prepared of preparedDevices) {
      if (prepared.kind === 'existing') {
        const device = await this.devicesReadRepository.findById(
          command.tenantId,
          prepared.id,
          transaction,
        );

        if (!device) {
          throwDeviceNotFound(prepared.id);
        }

        if (device.customerId !== customerId) {
          throwDeviceCustomerMismatch(prepared.id);
        }

        devices.push(device);
        continue;
      }

      const input = prepared.input;
      devices.push(
        await this.devicesRepository.create(
          {
            id: prepared.id,
            tenantId: command.tenantId,
            customerId,
            type: input.type,
            brand: input.brand.trim(),
            model: input.model.trim(),
            powerKw: input.powerKw,
            serialNumber: input.serialNumber.trim(),
            installationDate: prepared.installationDate,
            warrantyMonths: input.warrantyMonths,
            warrantyUntil: prepared.warrantyUntil,
            note: input.note.trim(),
            refrigerant: input.refrigerant.trim(),
            refrigerantAmount: input.refrigerantAmount.trim(),
            location: input.location.trim(),
            hasCustomInstallationAddress: input.hasCustomInstallationAddress,
            encryptedInstallationAddress: prepared.encryptedInstallationAddress,
          },
          transaction,
        ),
      );
    }

    return devices;
  }

  private async loadReplay(
    command: CreateVisitCommand,
    customerId: string,
    preparedDevices: readonly PreparedDevice[],
    preparedAttachments: readonly PreparedVisitAttachment[],
    transaction?: VisitsTransactionClient,
  ): Promise<TransactionResult | null> {
    const visit = await this.repository.findVisitById(
      command.tenantId,
      deriveCommandUuid(command, 'visit'),
      transaction,
    );

    if (!visit) {
      return null;
    }

    const expectedDeviceIds = preparedDevices.map((device) => device.id);
    const sameVisit =
      visit.type === command.dto.type &&
      visit.date.toISOString().slice(0, 10) === command.dto.performedOn &&
      visit.serviceOrderId === command.dto.serviceOrderId &&
      visit.user.id === command.userId &&
      visit.customer.id === customerId &&
      arraysEqual(
        visit.devices.map(({ device }) => device.id),
        expectedDeviceIds,
      ) &&
      arraysEqual(
        visit.attachments.map((attachment) => attachment.id),
        preparedAttachments.map((attachment) => attachment.id),
      ) &&
      visit.devices.every(
        (entry, index) =>
          entry.note === (preparedDevices[index]?.visitNote || null),
      ) &&
      visit.attachments.every((attachment, index) => {
        const expected = preparedAttachments[index];

        return (
          expected !== undefined &&
          attachment.fileName === expected.fileName &&
          attachment.contentType === expected.contentType &&
          attachment.sizeBytes === expected.sizeBytes &&
          attachment.description === (expected.description ?? null)
        );
      });

    if (!sameVisit) {
      throwIdempotencyKeyReused();
    }

    const completedServiceOrder = command.dto.serviceOrderId
      ? await this.repository.findServiceOrderById(
          command.tenantId,
          command.dto.serviceOrderId,
          transaction,
        )
      : null;
    const nextOrderId = deriveCommandUuid(command, 'next-inspection');
    const storedNextInspection = await this.repository.findServiceOrderById(
      command.tenantId,
      nextOrderId,
      transaction,
    );

    if (Boolean(storedNextInspection) !== Boolean(command.dto.nextInspection)) {
      throwIdempotencyKeyReused();
    }

    if (
      storedNextInspection &&
      storedNextInspection.scheduledAt?.toISOString() !==
        new Date(command.dto.nextInspection!.scheduledAt).toISOString()
    ) {
      throwIdempotencyKeyReused();
    }

    return {
      visit,
      completedServiceOrder,
      nextInspectionServiceOrder: storedNextInspection,
    };
  }
}
