import { ServiceOrderStatus } from '@generated/prisma/enums';

import { ListInspectionServiceOrdersQuery } from '../impl/list-inspection-service-orders.query';
import { ListInspectionServiceOrdersHandler } from './list-inspection-service-orders.handler';

jest.mock('../../inspection-service-order.mapper', () => ({
  InspectionServiceOrderMapper: jest.fn(),
}));
jest.mock('../../infrastructure/service-orders.read-repository', () => ({
  ServiceOrdersReadRepository: jest.fn(),
}));
jest.mock('../../../tenant-encryption/tenant-pii-cipher.service', () => ({
  TenantPiiCipherService: jest.fn(),
}));

describe('ListInspectionServiceOrdersHandler', () => {
  it('uses active statuses and excludes the selected device', async () => {
    const order = { id: 'order-1' };
    const mappedOrder = { id: 'order-1', serviceData: { deviceIds: [] } };
    const repository = {
      findInspections: jest.fn().mockResolvedValue([order]),
    };
    const mapper = { map: jest.fn().mockResolvedValue(mappedOrder) };
    const piiCipher = { decryptJson: jest.fn() };
    const handler = new ListInspectionServiceOrdersHandler(
      repository as unknown as ConstructorParameters<
        typeof ListInspectionServiceOrdersHandler
      >[0],
      mapper as unknown as ConstructorParameters<
        typeof ListInspectionServiceOrdersHandler
      >[1],
      piiCipher as unknown as ConstructorParameters<
        typeof ListInspectionServiceOrdersHandler
      >[2],
    );

    const result = await handler.execute(
      new ListInspectionServiceOrdersQuery('tenant-1', {
        customerId: 'customer-1',
        type: 'inspection',
        active: 'true',
        excludeDeviceId: 'device-1',
      }),
    );

    expect(repository.findInspections).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      statuses: [
        ServiceOrderStatus.new,
        ServiceOrderStatus.contact_required,
        ServiceOrderStatus.scheduled,
      ],
      excludeDeviceId: 'device-1',
    });
    expect(mapper.map).toHaveBeenCalledWith(order, piiCipher);
    expect(result).toEqual({ success: true, data: [mappedOrder] });
  });
});
