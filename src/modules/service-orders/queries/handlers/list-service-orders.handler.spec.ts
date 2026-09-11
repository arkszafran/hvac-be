import { ServiceOrderStatus } from '@generated/prisma/enums';

import { ListServiceOrdersQuery } from '../impl/list-service-orders.query';
import { ListServiceOrdersHandler } from './list-service-orders.handler';

jest.mock('../../infrastructure/service-orders.read-repository', () => ({
  ServiceOrdersReadRepository: jest.fn(),
}));
jest.mock('../../service-orders.mapper', () => ({
  ServiceOrdersMapper: jest.fn(),
  normalizeServiceOrderSearchValue: (value: string) => value.toLowerCase(),
}));

describe('ListServiceOrdersHandler', () => {
  it('applies defaults and never asks the repository for attachments', async () => {
    const repository = { findList: jest.fn().mockResolvedValue([{}]) };
    const item = {
      order: {
        id: 'order-1',
        type: 'inspection',
        source: 'system',
        status: 'new',
        orderDate: '2026-09-09T08:00:00.000Z',
        scheduledAt: null,
        createdAt: '2026-09-09T08:00:00.000Z',
        updatedAt: '2026-09-09T08:00:00.000Z',
      },
      customer: {
        companyName: 'Daikin Partner',
        fullName: '',
        phone: '',
        email: '',
        address: '',
        postalCode: '',
        city: '',
      },
      assignee: null,
      devices: [],
    };
    const mapper = { mapListItem: jest.fn().mockResolvedValue(item) };
    const handler = new ListServiceOrdersHandler(
      repository as never,
      mapper as never,
    );

    const response = await handler.execute(
      new ListServiceOrdersQuery('tenant-1', {
        q: 'daikin',
        statuses: [ServiceOrderStatus.new],
      }),
    );

    expect(repository.findList).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      statuses: [ServiceOrderStatus.new],
    });
    expect(response.data).toEqual({
      items: [item],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    });
  });
});
