import { ConfigService } from '@nestjs/config';
import { CustomerType } from '@generated/prisma/enums';

import { CustomersSortBy } from '../../dto/customers-query.dto';
import { ListCustomersQuery } from '../impl/list-customers.query';
import { ListCustomersHandler } from './list-customers.handler';

jest.mock('../../../tenant-encryption/tenant-pii-cipher.service', () => ({
  TenantPiiCipherService: jest.fn(),
}));
jest.mock('../../infrastructure/customers.read-repository', () => ({
  CustomersReadRepository: jest.fn(),
}));

describe('ListCustomersHandler', () => {
  const storedCustomers = [
    storedCustomer('customer-1', CustomerType.company),
    storedCustomer('customer-2', CustomerType.individual),
  ];
  const piiByCustomerId: Record<string, Record<string, string | null>> = {
    'customer-1': {
      companyName: 'Żuraw Serwis',
      fullName: 'Adam Nowak',
      phone: '111222333',
      email: 'adam@example.com',
      address: 'Piotrkowska 1',
      postalCode: '90-001',
      city: 'Łódź',
    },
    'customer-2': {
      companyName: null,
      fullName: 'Beata Kowalska',
      phone: '444555666',
      email: 'beata@example.com',
      address: 'Długa 2',
      postalCode: '00-002',
      city: 'Warszawa',
    },
  };

  it('returns every customer and ignores server operations in client mode', async () => {
    const { handler } = createHandler(2);

    const result = await handler.execute(
      new ListCustomersQuery('tenant-1', {
        q: 'does-not-match',
        page: 10,
        sortBy: CustomersSortBy.displayName,
      }),
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        filteringMode: 'client',
        totalItems: 2,
      },
    });
    expect(result.data.items).toHaveLength(2);
  });

  it('searches without case or Polish diacritics and paginates in server mode', async () => {
    const { handler } = createHandler(1);

    const result = await handler.execute(
      new ListCustomersQuery('tenant-1', {
        q: 'LODZ',
        page: 1,
        sortBy: CustomersSortBy.displayName,
      }),
    );

    expect(result).toEqual({
      success: true,
      data: {
        filteringMode: 'server',
        items: [expect.objectContaining({ id: 'customer-1', city: 'Łódź' })],
        pagination: {
          page: 1,
          pageSize: 1,
          totalItems: 1,
          totalPages: 1,
        },
      },
    });
  });

  function createHandler(clientFilteringLimit: number): {
    handler: ListCustomersHandler;
  } {
    const customersReadRepository = {
      findAll: jest.fn().mockResolvedValue(storedCustomers),
    };
    const piiCipher = {
      decryptJson: jest
        .fn()
        .mockImplementation(({ recordId }: { recordId: string }) =>
          Promise.resolve(piiByCustomerId[recordId]),
        ),
    };
    const configService = new ConfigService({
      CUSTOMERS_CLIENT_FILTERING_LIMIT: String(clientFilteringLimit),
      CUSTOMERS_PAGE_SIZE: '1',
    });

    return {
      handler: new ListCustomersHandler(
        customersReadRepository as unknown as ConstructorParameters<
          typeof ListCustomersHandler
        >[0],
        piiCipher as unknown as ConstructorParameters<
          typeof ListCustomersHandler
        >[1],
        configService,
      ),
    };
  }
});

function storedCustomer(id: string, type: CustomerType) {
  return {
    id,
    tenantId: 'tenant-1',
    type,
    piiCiphertext: Buffer.from('ciphertext'),
    piiNonce: Buffer.alloc(12),
    piiKeyVersion: 1,
    piiFormatVersion: 1,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-02T10:00:00.000Z'),
  };
}
