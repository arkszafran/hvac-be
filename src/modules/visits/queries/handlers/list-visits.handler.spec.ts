import {
  VisitSortBy,
  VisitSortDirection,
} from '../../dto/visits-list-query.dto';
import { ListVisitsQuery } from '../impl/list-visits.query';
import { ListVisitsHandler } from './list-visits.handler';

jest.mock('../../infrastructure/visits.read-repository', () => ({
  VisitsReadRepository: jest.fn(),
}));
jest.mock('../../visits.mapper', () => ({ VisitsMapper: jest.fn() }));
jest.mock('../../../tenant-encryption/tenant-pii-cipher.service', () => ({
  TenantPiiCipherService: jest.fn(),
}));

describe('ListVisitsHandler', () => {
  it('filters decrypted data, sorts it and paginates with requested values', async () => {
    const repository = {
      findAll: jest.fn().mockResolvedValue([{ id: 'one' }, { id: 'two' }]),
    };
    const items = [
      visitItem('one', '2026-09-01', 'Mitsubishi'),
      visitItem('two', '2026-09-02', 'Daikin'),
    ];
    const mapper = {
      mapVisit: jest
        .fn()
        .mockResolvedValueOnce(items[0])
        .mockResolvedValueOnce(items[1]),
    };
    const piiCipher = {};
    const handler = new ListVisitsHandler(
      repository as never,
      mapper as never,
      piiCipher as never,
    );

    const response = await handler.execute(
      new ListVisitsQuery('tenant-1', {
        q: 'DAIKIN',
        page: 1,
        pageSize: 1,
        sortBy: VisitSortBy.performedOn,
        sortDirection: VisitSortDirection.desc,
      }),
    );

    expect(repository.findAll).toHaveBeenCalledWith('tenant-1');
    expect(response).toEqual({
      success: true,
      data: {
        items: [items[1]],
        pagination: {
          page: 1,
          pageSize: 1,
          totalItems: 1,
          totalPages: 1,
        },
      },
    });
  });
});

function visitItem(id: string, performedOn: string, brand: string) {
  return {
    id,
    serviceOrderId: null,
    type: 'inspection' as const,
    performedOn,
    handledBy: { id: 'user-1', name: 'Jan' },
    customer: {
      id: 'customer-1',
      type: 'individual' as const,
      companyName: null,
      fullName: 'Jan Kowalski',
      phone: '500600700',
      email: 'jan@example.com',
      address: 'Długa 1',
      postalCode: '00-001',
      city: 'Warszawa',
    },
    devices: [
      {
        device: {
          id: `device-${id}`,
          type: 'air_conditioning' as const,
          brand,
          model: 'X',
          location: 'Salon',
          hasCustomInstallationAddress: false,
          address: 'Długa 1',
          postalCode: '00-001',
          city: 'Warszawa',
        },
        note: '',
      },
    ],
    createdAt: `${performedOn}T10:00:00.000Z`,
  };
}
