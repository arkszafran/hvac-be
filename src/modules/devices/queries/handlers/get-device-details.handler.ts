import { NotFoundException } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { TenantPiiCipherService } from '../../../tenant-encryption/tenant-pii-cipher.service';
import {
  ACTIVE_DEVICE_INSPECTION_STATUSES,
  DEVICES_ERROR_CODES,
} from '../../devices.constants';
import { DevicesMapper } from '../../devices.mapper';
import type { DeviceDetailsDto } from '../../dto/device-response.dto';
import { DeviceCustomersReadRepository } from '../../infrastructure/device-customers.read-repository';
import { DevicesReadRepository } from '../../infrastructure/devices.read-repository';
import { GetDeviceDetailsQuery } from '../impl/get-device-details.query';

@QueryHandler(GetDeviceDetailsQuery)
export class GetDeviceDetailsHandler implements IQueryHandler<
  GetDeviceDetailsQuery,
  ApiSuccessResponse<DeviceDetailsDto>
> {
  constructor(
    private readonly devicesReadRepository: DevicesReadRepository,
    private readonly deviceCustomersReadRepository: DeviceCustomersReadRepository,
    private readonly devicesMapper: DevicesMapper,
    private readonly piiCipher: TenantPiiCipherService,
  ) {}

  async execute(
    query: GetDeviceDetailsQuery,
  ): Promise<ApiSuccessResponse<DeviceDetailsDto>> {
    const device = await this.devicesReadRepository.findById(
      query.tenantId,
      query.deviceId,
    );

    if (!device) {
      throwDeviceNotFound();
    }

    const [customer, visits, activeInspection] = await Promise.all([
      this.deviceCustomersReadRepository.findById(
        query.tenantId,
        device.customerId,
      ),
      this.devicesReadRepository.findVisits(query.tenantId, query.deviceId),
      this.devicesReadRepository.findActiveInspectionForDevice(
        query.tenantId,
        query.deviceId,
        ACTIVE_DEVICE_INSPECTION_STATUSES,
      ),
    ]);

    if (!customer) {
      throwDeviceNotFound();
    }

    const customerPii = await this.devicesMapper.decryptCustomer(
      customer,
      this.piiCipher,
    );
    const [deviceDto, activeInspectionDto] = await Promise.all([
      this.devicesMapper.mapDevice(device, this.piiCipher),
      activeInspection
        ? this.devicesMapper.mapInspection(
            activeInspection,
            customerPii,
            this.piiCipher,
          )
        : Promise.resolve(null),
    ]);

    return apiSuccess({
      customer: this.devicesMapper.mapCustomer(customer, customerPii),
      device: deviceDto,
      activeInspection: activeInspectionDto,
      visits: this.devicesMapper.mapVisits(query.deviceId, visits),
    });
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
