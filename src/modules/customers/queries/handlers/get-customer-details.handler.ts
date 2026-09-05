import { NotFoundException } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { ServiceOrderStatus, ServiceOrderType } from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { TenantPiiCipherService } from '../../../tenant-encryption/tenant-pii-cipher.service';
import { CUSTOMERS_ERROR_CODES } from '../../customers.constants';
import {
  mapCustomerDto,
  mapCustomerServiceOrderDto,
} from '../../customers.mapper';
import {
  parseCustomerPii,
  parseInstallationAddress,
  type CustomerPii,
  type StoredDevice,
} from '../../customers.types';
import type {
  CustomerDetailsDto,
  CustomerDeviceListItemDto,
  InspectionServiceOrderDto,
} from '../../dto/customer-response.dto';
import { CustomersReadRepository } from '../../infrastructure/customers.read-repository';
import { GetCustomerDetailsQuery } from '../impl/get-customer-details.query';

const ACTIVE_INSPECTION_STATUSES = new Set<ServiceOrderStatus>([
  ServiceOrderStatus.new,
  ServiceOrderStatus.contact_required,
  ServiceOrderStatus.scheduled,
]);

@QueryHandler(GetCustomerDetailsQuery)
export class GetCustomerDetailsHandler implements IQueryHandler<
  GetCustomerDetailsQuery,
  ApiSuccessResponse<CustomerDetailsDto>
> {
  constructor(
    private readonly customersReadRepository: CustomersReadRepository,
    private readonly piiCipher: TenantPiiCipherService,
  ) {}

  async execute(
    query: GetCustomerDetailsQuery,
  ): Promise<ApiSuccessResponse<CustomerDetailsDto>> {
    const details = await this.customersReadRepository.findDetails(
      query.tenantId,
      query.customerId,
    );

    if (!details) {
      throw new NotFoundException(
        apiError({
          code: CUSTOMERS_ERROR_CODES.notFound,
          message: 'Customer was not found.',
        }),
      );
    }

    const customerPii = parseCustomerPii(
      await this.piiCipher.decryptJson({
        tenantId: query.tenantId,
        recordId: details.customer.id,
        purpose: ENCRYPTION_PURPOSES.customerPii,
        encrypted: {
          ciphertext: details.customer.piiCiphertext,
          nonce: details.customer.piiNonce,
          keyVersion: details.customer.piiKeyVersion,
          formatVersion: details.customer.piiFormatVersion,
        },
      }),
    );
    const serviceOrders = details.serviceOrders.map(mapCustomerServiceOrderDto);
    const activeInspectionByDeviceId = new Map<
      string,
      InspectionServiceOrderDto
    >();

    for (const serviceOrder of details.serviceOrders) {
      if (
        serviceOrder.type !== ServiceOrderType.inspection ||
        !ACTIVE_INSPECTION_STATUSES.has(serviceOrder.status)
      ) {
        continue;
      }

      const inspection = mapCustomerServiceOrderDto(
        serviceOrder,
      ) as InspectionServiceOrderDto;

      for (const deviceId of serviceOrder.deviceIds) {
        if (!activeInspectionByDeviceId.has(deviceId)) {
          activeInspectionByDeviceId.set(deviceId, inspection);
        }
      }
    }

    const devices = await Promise.all(
      details.devices.map((device) =>
        this.mapDevice(
          query.tenantId,
          device,
          customerPii,
          activeInspectionByDeviceId.get(device.id) ?? null,
        ),
      ),
    );

    return apiSuccess({
      customer: mapCustomerDto(details.customer, customerPii),
      devices,
      serviceOrders,
    });
  }

  private async mapDevice(
    tenantId: string,
    device: StoredDevice,
    customerPii: CustomerPii,
    activeInspection: InspectionServiceOrderDto | null,
  ): Promise<CustomerDeviceListItemDto> {
    let installationAddress = {
      address: customerPii.address,
      postalCode: customerPii.postalCode,
      city: customerPii.city,
    };

    if (device.hasCustomInstallationAddress) {
      if (
        !device.installationAddressCiphertext ||
        !device.installationAddressNonce ||
        device.installationAddressKeyVersion === null ||
        device.installationAddressFormatVersion === null
      ) {
        throw new Error('Device custom installation address is missing.');
      }

      installationAddress = parseInstallationAddress(
        await this.piiCipher.decryptJson({
          tenantId,
          recordId: device.id,
          purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
          encrypted: {
            ciphertext: device.installationAddressCiphertext,
            nonce: device.installationAddressNonce,
            keyVersion: device.installationAddressKeyVersion,
            formatVersion: device.installationAddressFormatVersion,
          },
        }),
      );
    }

    return {
      id: device.id,
      customerId: device.customerId,
      type: device.type,
      brand: device.brand,
      model: device.model,
      serialNumber: device.serialNumber ?? '',
      installationDate: device.installationDate
        ? device.installationDate.toISOString().slice(0, 10)
        : '',
      location: device.location ?? '',
      hasCustomInstallationAddress: device.hasCustomInstallationAddress,
      address: installationAddress.address,
      postalCode: installationAddress.postalCode,
      city: installationAddress.city,
      activeInspection,
    };
  }
}
