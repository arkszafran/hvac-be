import { ConfigService } from '@nestjs/config';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import {
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { TenantPiiCipherService } from '../../../tenant-encryption/tenant-pii-cipher.service';
import { DevicesMapper } from '../../devices.mapper';
import type { DeviceCustomerPii } from '../../devices.types';
import type {
  DeviceListItemDto,
  DevicesListDataDto,
} from '../../dto/device-response.dto';
import { DevicesReadRepository } from '../../infrastructure/devices.read-repository';
import { ListDevicesQuery } from '../impl/list-devices.query';

@QueryHandler(ListDevicesQuery)
export class ListDevicesHandler implements IQueryHandler<
  ListDevicesQuery,
  ApiSuccessResponse<DevicesListDataDto>
> {
  private readonly clientFilteringLimit: number;
  private readonly pageSize: number;

  constructor(
    private readonly devicesReadRepository: DevicesReadRepository,
    private readonly devicesMapper: DevicesMapper,
    private readonly piiCipher: TenantPiiCipherService,
    configService: ConfigService,
  ) {
    this.clientFilteringLimit = Number(
      configService.getOrThrow<string | number>(
        'DEVICES_CLIENT_FILTERING_LIMIT',
      ),
    );
    this.pageSize = Number(
      configService.getOrThrow<string | number>('DEVICES_PAGE_SIZE'),
    );
  }

  async execute(
    query: ListDevicesQuery,
  ): Promise<ApiSuccessResponse<DevicesListDataDto>> {
    const storedItems = await this.devicesReadRepository.findAll(
      query.tenantId,
    );
    const customerPiiById = new Map<string, Promise<DeviceCustomerPii>>();
    const items = await Promise.all(
      storedItems.map(async ({ device, customer }) => {
        let customerPiiPromise = customerPiiById.get(customer.id);

        if (!customerPiiPromise) {
          customerPiiPromise = this.devicesMapper.decryptCustomer(
            customer,
            this.piiCipher,
          );
          customerPiiById.set(customer.id, customerPiiPromise);
        }

        const customerPii = await customerPiiPromise;

        return this.devicesMapper.mapDeviceListItem(
          device,
          customer,
          customerPii,
          this.piiCipher,
        );
      }),
    );

    if (items.length <= this.clientFilteringLimit) {
      return apiSuccess({
        filteringMode: 'client',
        items,
        totalItems: items.length,
      });
    }

    const filteredItems = filterDevices(items, query.dto.q);
    const page = query.dto.page ?? 1;
    const firstItemIndex = (page - 1) * this.pageSize;

    return apiSuccess({
      filteringMode: 'server',
      items: filteredItems.slice(
        firstItemIndex,
        firstItemIndex + this.pageSize,
      ),
      pagination: {
        page,
        pageSize: this.pageSize,
        totalItems: filteredItems.length,
        totalPages: Math.ceil(filteredItems.length / this.pageSize),
      },
    });
  }
}

function filterDevices(
  devices: readonly DeviceListItemDto[],
  phrase?: string,
): DeviceListItemDto[] {
  if (!phrase) {
    return [...devices];
  }

  const normalizedPhrase = normalizeSearchValue(phrase);

  return devices.filter((device) =>
    [
      device.brand,
      device.model,
      device.location,
      device.address,
      device.postalCode,
      device.city,
      device.customer.companyName,
      device.customer.fullName,
      device.customer.phone,
      device.customer.email,
      device.customer.address,
      device.customer.postalCode,
      device.customer.city,
    ].some(
      (value) =>
        value !== null &&
        normalizeSearchValue(value).includes(normalizedPhrase),
    ),
  );
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0142/gi, (letter) => (letter === '\u0141' ? 'L' : 'l'))
    .toLocaleLowerCase('pl');
}
