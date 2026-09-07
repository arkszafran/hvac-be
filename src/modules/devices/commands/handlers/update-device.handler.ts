import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import {
  ApplyDeviceInspectionOperationCommand,
  type DeviceInspectionOperation,
} from '../../../service-orders/service-orders-device-operation.contract';
import { TenantPiiCipherService } from '../../../tenant-encryption/tenant-pii-cipher.service';
import { DEVICES_ERROR_CODES } from '../../devices.constants';
import { resolveCustomInstallationAddressUpdate } from '../../devices.helpers';
import {
  calculateWarrantyUntil,
  DevicesMapper,
  parseDeviceDate,
} from '../../devices.mapper';
import type { DeviceMutationResultDto } from '../../dto/device-response.dto';
import {
  UpdateDeviceServiceOrderAction,
  type UpdateDeviceServiceOrderCommandDto,
} from '../../dto/update-device.dto';
import { DeviceCustomersReadRepository } from '../../infrastructure/device-customers.read-repository';
import { DevicesReadRepository } from '../../infrastructure/devices.read-repository';
import { DevicesRepository } from '../../infrastructure/devices.repository';
import { UpdateDeviceCommand } from '../impl/update-device.command';

@CommandHandler(UpdateDeviceCommand)
export class UpdateDeviceHandler implements ICommandHandler<
  UpdateDeviceCommand,
  ApiSuccessResponse<DeviceMutationResultDto>
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devicesRepository: DevicesRepository,
    private readonly devicesReadRepository: DevicesReadRepository,
    private readonly deviceCustomersReadRepository: DeviceCustomersReadRepository,
    private readonly devicesMapper: DevicesMapper,
    private readonly piiCipher: TenantPiiCipherService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: UpdateDeviceCommand,
  ): Promise<ApiSuccessResponse<DeviceMutationResultDto>> {
    return this.prisma.$transaction(async (transaction) => {
      const currentDevice = await this.devicesReadRepository.findById(
        command.tenantId,
        command.deviceId,
        transaction,
      );

      if (!currentDevice) {
        throwDeviceNotFound();
      }

      const customer = await this.deviceCustomersReadRepository.findById(
        command.tenantId,
        currentDevice.customerId,
        transaction,
      );

      if (!customer) {
        throwDeviceNotFound();
      }

      const hasCustomInstallationAddress =
        command.dto.hasCustomInstallationAddress !== undefined
          ? command.dto.hasCustomInstallationAddress
          : currentDevice.hasCustomInstallationAddress;
      const customAddressUpdate = resolveCustomInstallationAddressUpdate(
        hasCustomInstallationAddress,
        currentDevice.hasCustomInstallationAddress,
        command.dto,
      );
      const customAddress =
        customAddressUpdate.action === 'replace'
          ? customAddressUpdate.value
          : undefined;
      const encryptedInstallationAddress =
        customAddressUpdate.action === 'preserve'
          ? undefined
          : customAddress
            ? await this.piiCipher.encryptJson({
                tenantId: command.tenantId,
                recordId: currentDevice.id,
                purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
                value: customAddress,
              })
            : null;
      const installationDateText =
        command.dto.installationDate ??
        currentDevice.installationDate?.toISOString().slice(0, 10) ??
        '';

      const installationDate = parseDeviceDate(installationDateText);
      const warrantyMonths =
        command.dto.warrantyMonths ?? currentDevice.warrantyMonths;

      if (!installationDate && warrantyMonths > 0) {
        throw new BadRequestException(
          apiError({
            code: DEVICES_ERROR_CODES.invalidInstallationDate,
            message: 'Installation date is required when warranty is enabled.',
          }),
        );
      }
      const device = await this.devicesRepository.update(
        {
          id: currentDevice.id,
          tenantId: command.tenantId,
          customerId: currentDevice.customerId,
          type: command.dto.type ?? currentDevice.type,
          brand: (command.dto.brand ?? currentDevice.brand).trim(),
          model: (command.dto.model ?? currentDevice.model).trim(),
          powerKw:
            command.dto.powerKw !== undefined
              ? command.dto.powerKw
              : currentDevice.powerKw,
          serialNumber: (
            command.dto.serialNumber ??
            currentDevice.serialNumber ??
            ''
          ).trim(),
          installationDate,
          warrantyMonths,
          warrantyUntil: calculateWarrantyUntil(
            installationDate,
            warrantyMonths,
          ),
          note: (command.dto.note ?? currentDevice.note ?? '').trim(),
          refrigerant: (
            command.dto.refrigerant ??
            currentDevice.refrigerant ??
            ''
          ).trim(),
          refrigerantAmount: (
            command.dto.refrigerantAmount ??
            currentDevice.refrigerantAmount ??
            ''
          ).trim(),
          location: (
            command.dto.location ??
            currentDevice.location ??
            ''
          ).trim(),
          hasCustomInstallationAddress,
          encryptedInstallationAddress,
        },
        transaction,
      );

      if (!device) {
        throwDeviceNotFound();
      }

      if (command.dto.serviceOrder) {
        await this.commandBus.execute(
          new ApplyDeviceInspectionOperationCommand(
            {
              tenantId: command.tenantId,
              customerId: customer.id,
              customerType: customer.type,
              deviceId: device.id,
            },
            mapServiceOrderOperation(command.dto.serviceOrder),
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

function mapServiceOrderOperation(
  command: UpdateDeviceServiceOrderCommandDto,
): DeviceInspectionOperation {
  switch (command.action) {
    case UpdateDeviceServiceOrderAction.createInspection:
      return {
        action: 'create_inspection',
        scheduledAt: command.scheduledAt!,
      };
    case UpdateDeviceServiceOrderAction.attachInspection:
      return {
        action: 'attach_inspection',
        serviceOrderId: command.serviceOrderId!,
      };
    case UpdateDeviceServiceOrderAction.detachInspection:
      return {
        action: 'detach_inspection',
        serviceOrderId: command.serviceOrderId!,
      };
    case UpdateDeviceServiceOrderAction.rescheduleInspection:
      return {
        action: 'reschedule_inspection',
        currentServiceOrderId: command.currentServiceOrderId!,
        scheduledAt: command.scheduledAt!,
      };
    case UpdateDeviceServiceOrderAction.moveToNewInspection:
      return {
        action: 'move_to_new_inspection',
        currentServiceOrderId: command.currentServiceOrderId!,
        scheduledAt: command.scheduledAt!,
      };
  }
}

function throwDeviceNotFound(): never {
  throw new NotFoundException(
    apiError({
      code: DEVICES_ERROR_CODES.notFound,
      message: 'Device was not found.',
    }),
  );
}
