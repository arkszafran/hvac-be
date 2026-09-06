import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { ApplyDeviceInspectionOperationCommand } from '../../../service-orders/service-orders-device-operation.contract';
import { TenantPiiCipherService } from '../../../tenant-encryption/tenant-pii-cipher.service';
import { DEVICES_ERROR_CODES } from '../../devices.constants';
import { resolveCustomInstallationAddressUpdate } from '../../devices.helpers';
import {
  calculateWarrantyUntil,
  DevicesMapper,
  parseDeviceDate,
} from '../../devices.mapper';
import { CreateDeviceServiceOrderAction } from '../../dto/create-device.dto';
import type { DeviceMutationResultDto } from '../../dto/device-response.dto';
import { DeviceCustomersReadRepository } from '../../infrastructure/device-customers.read-repository';
import { DevicesRepository } from '../../infrastructure/devices.repository';
import { CreateDeviceCommand } from '../impl/create-device.command';

@CommandHandler(CreateDeviceCommand)
export class CreateDeviceHandler implements ICommandHandler<
  CreateDeviceCommand,
  ApiSuccessResponse<DeviceMutationResultDto>
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devicesRepository: DevicesRepository,
    private readonly deviceCustomersReadRepository: DeviceCustomersReadRepository,
    private readonly devicesMapper: DevicesMapper,
    private readonly piiCipher: TenantPiiCipherService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: CreateDeviceCommand,
  ): Promise<ApiSuccessResponse<DeviceMutationResultDto>> {
    const deviceId = randomUUID();
    const customAddressUpdate = resolveCustomInstallationAddressUpdate(
      command.dto.hasCustomInstallationAddress,
      false,
      command.dto,
    );
    const customAddress =
      customAddressUpdate.action === 'replace'
        ? customAddressUpdate.value
        : null;

    return this.prisma.$transaction(async (transaction) => {
      const customer = await this.deviceCustomersReadRepository.findById(
        command.tenantId,
        command.dto.customerId,
        transaction,
      );

      if (!customer) {
        throwCustomerNotFound();
      }

      const encryptedInstallationAddress = customAddress
        ? await this.piiCipher.encryptJson({
            tenantId: command.tenantId,
            recordId: deviceId,
            purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
            value: customAddress,
          })
        : null;
      const installationDate = parseDeviceDate(command.dto.installationDate);

      if (!installationDate && command.dto.warrantyMonths > 0) {
        throwInvalidInstallationDate();
      }

      const device = await this.devicesRepository.create(
        {
          id: deviceId,
          tenantId: command.tenantId,
          customerId: customer.id,
          type: command.dto.type,
          brand: command.dto.brand.trim(),
          model: command.dto.model.trim(),
          powerKw: command.dto.powerKw,
          serialNumber: command.dto.serialNumber.trim(),
          installationDate,
          warrantyMonths: command.dto.warrantyMonths,
          warrantyUntil: calculateWarrantyUntil(
            installationDate,
            command.dto.warrantyMonths,
          ),
          note: command.dto.note.trim(),
          refrigerant: command.dto.refrigerant.trim(),
          refrigerantAmount: command.dto.refrigerantAmount.trim(),
          location: command.dto.location.trim(),
          hasCustomInstallationAddress:
            command.dto.hasCustomInstallationAddress,
          encryptedInstallationAddress,
        },
        transaction,
      );

      if (command.dto.serviceOrder) {
        const context = {
          tenantId: command.tenantId,
          customerId: customer.id,
          customerType: customer.type,
          deviceId: device.id,
        };

        const operation =
          command.dto.serviceOrder.action ===
          CreateDeviceServiceOrderAction.createInspection
            ? {
                action: 'create_inspection' as const,
                scheduledAt: command.dto.serviceOrder.scheduledAt!,
              }
            : {
                action: 'attach_inspection' as const,
                serviceOrderId: command.dto.serviceOrder.serviceOrderId!,
              };

        await this.commandBus.execute(
          new ApplyDeviceInspectionOperationCommand(
            context,
            operation,
            transaction,
          ),
        );
      }

      return apiSuccess({
        device: await this.devicesMapper.mapDevice(
          device,
          this.piiCipher,
          customAddress ?? undefined,
        ),
      });
    });
  }
}

function throwCustomerNotFound(): never {
  throw new NotFoundException(
    apiError({
      code: DEVICES_ERROR_CODES.customerNotFound,
      message: 'Device customer was not found.',
    }),
  );
}

function throwInvalidInstallationDate(): never {
  throw new BadRequestException(
    apiError({
      code: DEVICES_ERROR_CODES.invalidInstallationDate,
      message: 'Installation date is required when warranty is enabled.',
    }),
  );
}
