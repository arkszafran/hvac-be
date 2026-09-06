import { CustomerType, DeviceType, VisitType } from '@generated/prisma/enums';

import { GetDeviceDetailsQuery } from '../impl/get-device-details.query';
import { GetDeviceDetailsHandler } from './get-device-details.handler';

jest.mock('../../infrastructure/device-customers.read-repository', () => ({
  DeviceCustomersReadRepository: jest.fn(),
}));
jest.mock('../../devices.mapper', () => ({ DevicesMapper: jest.fn() }));
jest.mock('../../infrastructure/devices.read-repository', () => ({
  DevicesReadRepository: jest.fn(),
}));
jest.mock('../../../tenant-encryption/tenant-pii-cipher.service', () => ({
  TenantPiiCipherService: jest.fn(),
}));

describe('GetDeviceDetailsHandler', () => {
  it('returns customer, device, active inspection and device-scoped visits', async () => {
    const device = {
      id: 'device-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      type: DeviceType.air_conditioning,
    };
    const customer = {
      id: 'customer-1',
      tenantId: 'tenant-1',
      type: CustomerType.individual,
    };
    const visits = [
      {
        id: 'visit-2',
        date: new Date('2026-09-04T00:00:00.000Z'),
        type: VisitType.inspection,
      },
      {
        id: 'visit-1',
        date: new Date('2026-08-01T00:00:00.000Z'),
        type: VisitType.repair,
      },
    ];
    const activeInspection = { id: 'order-1' };
    const customerPii = { fullName: 'Jan Kowalski' };
    const mappedDevice = { id: 'device-1' };
    const mappedCustomer = { id: 'customer-1' };
    const mappedVisits = [{ id: 'visit-2' }, { id: 'visit-1' }];
    const mappedInspection = { id: 'order-1' };
    const devicesReadRepository = {
      findById: jest.fn().mockResolvedValue(device),
      findVisits: jest.fn().mockResolvedValue(visits),
      findActiveInspectionForDevice: jest
        .fn()
        .mockResolvedValue(activeInspection),
    };
    const deviceCustomersReadRepository = {
      findById: jest.fn().mockResolvedValue(customer),
    };
    const devicesMapper = {
      decryptCustomer: jest.fn().mockResolvedValue(customerPii),
      mapDevice: jest.fn().mockResolvedValue(mappedDevice),
      mapCustomer: jest.fn().mockReturnValue(mappedCustomer),
      mapVisits: jest.fn().mockReturnValue(mappedVisits),
      mapInspection: jest.fn().mockResolvedValue(mappedInspection),
    };
    const piiCipher = { decryptJson: jest.fn() };
    const handler = new GetDeviceDetailsHandler(
      devicesReadRepository as unknown as ConstructorParameters<
        typeof GetDeviceDetailsHandler
      >[0],
      deviceCustomersReadRepository as unknown as ConstructorParameters<
        typeof GetDeviceDetailsHandler
      >[1],
      devicesMapper as unknown as ConstructorParameters<
        typeof GetDeviceDetailsHandler
      >[2],
      piiCipher as unknown as ConstructorParameters<
        typeof GetDeviceDetailsHandler
      >[3],
    );

    const result = await handler.execute(
      new GetDeviceDetailsQuery('tenant-1', 'device-1'),
    );

    expect(devicesReadRepository.findVisits).toHaveBeenCalledWith(
      'tenant-1',
      'device-1',
    );
    expect(
      devicesReadRepository.findActiveInspectionForDevice,
    ).toHaveBeenCalledWith('tenant-1', 'device-1', expect.any(Array));
    expect(devicesMapper.mapInspection).toHaveBeenCalledWith(
      activeInspection,
      customerPii,
      piiCipher,
    );
    expect(devicesMapper.mapVisits).toHaveBeenCalledWith('device-1', visits);
    expect(result).toEqual({
      success: true,
      data: {
        customer: mappedCustomer,
        device: mappedDevice,
        activeInspection: mappedInspection,
        visits: mappedVisits,
      },
    });
  });
});
