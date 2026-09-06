import {
  CustomerType,
  ServiceOrderSource,
  ServiceOrderStatus,
  ServiceOrderType,
} from '@generated/prisma/enums';

import { ServiceOrdersRepository } from './service-orders.repository';

jest.mock('../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('ServiceOrdersRepository', () => {
  it('creates an inspection without customer and device snapshots', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const repository = new ServiceOrdersRepository({} as never);
    const transaction = { serviceOrder: { create } };
    const scheduledAt = new Date('2027-02-20T08:00:00.000Z');
    const now = new Date('2026-09-05T10:00:00.000Z');

    await repository.createInspection(
      {
        id: 'order-1',
        tenantId: 'tenant-1',
        customerId: 'customer-1',
        customerType: CustomerType.individual,
        deviceId: 'device-1',
        scheduledAt,
        now,
      },
      transaction as never,
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        id: 'order-1',
        tenantId: 'tenant-1',
        customerId: 'customer-1',
        customerType: CustomerType.individual,
        type: ServiceOrderType.inspection,
        source: ServiceOrderSource.user,
        status: ServiceOrderStatus.new,
        orderDate: now,
        scheduledAt,
        devices: {
          create: {
            systemDeviceId: 'device-1',
            sortOrder: 0,
          },
        },
      },
    });
  });

  it('attaches an existing device by relation only', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const repository = new ServiceOrdersRepository({} as never);
    const transaction = { serviceOrderDevice: { create } };

    await repository.attachDevice(
      'order-1',
      'device-1',
      2,
      transaction as never,
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        serviceOrderId: 'order-1',
        systemDeviceId: 'device-1',
        sortOrder: 2,
      },
    });
  });
});
