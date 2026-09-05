import {
  CustomerType,
  DeviceType,
  ServiceOrderSource,
  ServiceOrderStatus,
  ServiceOrderType,
} from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import { GetCustomerDetailsQuery } from '../impl/get-customer-details.query';
import { GetCustomerDetailsHandler } from './get-customer-details.handler';

jest.mock('../../../tenant-encryption/tenant-pii-cipher.service', () => ({
  TenantPiiCipherService: jest.fn(),
}));
jest.mock('../../infrastructure/customers.read-repository', () => ({
  CustomersReadRepository: jest.fn(),
}));

describe('GetCustomerDetailsHandler', () => {
  it('returns tenant-scoped aggregate and assigns the current inspection', async () => {
    const customer = {
      id: 'customer-1',
      tenantId: 'tenant-1',
      type: CustomerType.individual,
      piiCiphertext: Buffer.from('customer-ciphertext'),
      piiNonce: Buffer.alloc(12),
      piiKeyVersion: 1,
      piiFormatVersion: 1,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-02T10:00:00.000Z'),
    };
    const details = {
      customer,
      devices: [
        {
          id: 'device-1',
          customerId: customer.id,
          type: DeviceType.air_conditioning,
          brand: 'Daikin',
          model: 'Perfera',
          serialNumber: 'SN-1',
          installationDate: new Date('2025-05-10T00:00:00.000Z'),
          location: 'Salon',
          hasCustomInstallationAddress: true,
          installationAddressCiphertext: Buffer.from('address-ciphertext'),
          installationAddressNonce: Buffer.alloc(12, 1),
          installationAddressKeyVersion: 1,
          installationAddressFormatVersion: 1,
        },
      ],
      serviceOrders: [
        {
          id: 'order-1',
          customerId: customer.id,
          type: ServiceOrderType.inspection,
          source: ServiceOrderSource.user,
          status: ServiceOrderStatus.scheduled,
          assigneeUserId: null,
          orderDate: new Date('2026-09-03T10:00:00.000Z'),
          scheduledAt: new Date('2026-09-10T10:00:00.000Z'),
          nextContactAt: null,
          createdAt: new Date('2026-09-03T10:00:00.000Z'),
          updatedAt: new Date('2026-09-03T10:00:00.000Z'),
          deviceIds: ['device-1'],
        },
      ],
    };
    const customersReadRepository = {
      findDetails: jest.fn().mockResolvedValue(details),
    };
    const piiCipher = {
      decryptJson: jest
        .fn()
        .mockImplementation(({ purpose }: { purpose: string }) =>
          Promise.resolve(
            purpose === ENCRYPTION_PURPOSES.customerPii
              ? {
                  companyName: '',
                  fullName: 'Jan Kowalski',
                  phone: '500600700',
                  email: 'jan@example.com',
                  address: 'Długa 1',
                  postalCode: '00-001',
                  city: 'Warszawa',
                }
              : {
                  address: 'Leśna 2',
                  postalCode: '90-001',
                  city: 'Łódź',
                },
          ),
        ),
    };
    const handler = new GetCustomerDetailsHandler(
      customersReadRepository as unknown as ConstructorParameters<
        typeof GetCustomerDetailsHandler
      >[0],
      piiCipher as unknown as ConstructorParameters<
        typeof GetCustomerDetailsHandler
      >[1],
    );

    const result = await handler.execute(
      new GetCustomerDetailsQuery('tenant-1', 'customer-1'),
    );

    expect(customersReadRepository.findDetails).toHaveBeenCalledWith(
      'tenant-1',
      'customer-1',
    );
    expect(result.data.devices[0]).toMatchObject({
      address: 'Leśna 2',
      city: 'Łódź',
      installationDate: '2025-05-10',
      activeInspection: {
        id: 'order-1',
        type: ServiceOrderType.inspection,
        status: ServiceOrderStatus.scheduled,
      },
    });
    expect(result.data.serviceOrders).toHaveLength(1);
    expect(result.data.serviceOrders[0]).not.toHaveProperty('deviceIds');
    expect(piiCipher.decryptJson).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        recordId: 'device-1',
        purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
      }),
    );
  });
});
