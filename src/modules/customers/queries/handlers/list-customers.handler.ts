import { ConfigService } from '@nestjs/config';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import {
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { TenantPiiCipherService } from '../../../tenant-encryption/tenant-pii-cipher.service';
import {
  getCustomerDisplayName,
  mapCustomerListItemDto,
  normalizeCustomerSearchValue,
} from '../../customers.mapper';
import { parseCustomerPii } from '../../customers.types';
import type {
  CustomerListItemDto,
  CustomersListDataDto,
} from '../../dto/customer-response.dto';
import { CustomersSortBy, SortDirection } from '../../dto/customers-query.dto';
import { CustomersReadRepository } from '../../infrastructure/customers.read-repository';
import { ListCustomersQuery } from '../impl/list-customers.query';

const DISPLAY_NAME_COLLATOR = new Intl.Collator('pl', {
  sensitivity: 'base',
  numeric: true,
});

@QueryHandler(ListCustomersQuery)
export class ListCustomersHandler implements IQueryHandler<
  ListCustomersQuery,
  ApiSuccessResponse<CustomersListDataDto>
> {
  private readonly clientFilteringLimit: number;
  private readonly pageSize: number;

  constructor(
    private readonly customersReadRepository: CustomersReadRepository,
    private readonly piiCipher: TenantPiiCipherService,
    configService: ConfigService,
  ) {
    this.clientFilteringLimit = Number(
      configService.getOrThrow<string | number>(
        'CUSTOMERS_CLIENT_FILTERING_LIMIT',
      ),
    );
    this.pageSize = Number(
      configService.getOrThrow<string | number>('CUSTOMERS_PAGE_SIZE'),
    );
  }

  async execute(
    query: ListCustomersQuery,
  ): Promise<ApiSuccessResponse<CustomersListDataDto>> {
    const storedCustomers = await this.customersReadRepository.findAll(
      query.tenantId,
    );
    const items = await Promise.all(
      storedCustomers.map(async (customer): Promise<CustomerListItemDto> => {
        const pii = parseCustomerPii(
          await this.piiCipher.decryptJson({
            tenantId: query.tenantId,
            recordId: customer.id,
            purpose: ENCRYPTION_PURPOSES.customerPii,
            encrypted: {
              ciphertext: customer.piiCiphertext,
              nonce: customer.piiNonce,
              keyVersion: customer.piiKeyVersion,
              formatVersion: customer.piiFormatVersion,
            },
          }),
        );

        return mapCustomerListItemDto(customer, pii);
      }),
    );

    if (items.length <= this.clientFilteringLimit) {
      return apiSuccess({
        filteringMode: 'client',
        items,
        totalItems: items.length,
      });
    }

    const filteredItems = filterCustomers(items, query.dto.q);
    const sortedItems = sortCustomers(
      filteredItems,
      query.dto.sortBy,
      query.dto.sortDirection,
    );
    const page = query.dto.page ?? 1;
    const firstItemIndex = (page - 1) * this.pageSize;

    return apiSuccess({
      filteringMode: 'server',
      items: sortedItems.slice(firstItemIndex, firstItemIndex + this.pageSize),
      pagination: {
        page,
        pageSize: this.pageSize,
        totalItems: sortedItems.length,
        totalPages: Math.ceil(sortedItems.length / this.pageSize),
      },
    });
  }
}

function filterCustomers(
  customers: readonly CustomerListItemDto[],
  phrase?: string,
): CustomerListItemDto[] {
  if (!phrase) {
    return [...customers];
  }

  const normalizedPhrase = normalizeCustomerSearchValue(phrase);

  return customers.filter((customer) =>
    [
      customer.companyName,
      customer.fullName,
      customer.phone,
      customer.email,
      customer.address,
      customer.postalCode,
      customer.city,
    ].some(
      (value) =>
        value !== null &&
        normalizeCustomerSearchValue(value).includes(normalizedPhrase),
    ),
  );
}

function sortCustomers(
  customers: readonly CustomerListItemDto[],
  sortBy?: CustomersSortBy,
  sortDirection: SortDirection = SortDirection.asc,
): CustomerListItemDto[] {
  if (sortBy !== CustomersSortBy.displayName) {
    return [...customers];
  }

  const direction = sortDirection === SortDirection.desc ? -1 : 1;

  return [...customers].sort(
    (left, right) =>
      DISPLAY_NAME_COLLATOR.compare(
        getCustomerDisplayName(left),
        getCustomerDisplayName(right),
      ) * direction,
  );
}
