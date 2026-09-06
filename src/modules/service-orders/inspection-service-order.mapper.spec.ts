import {
  ServiceOrderSource,
  ServiceOrderStatus,
} from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../common/encryption/encryption.types';
import { InspectionServiceOrderMapper } from './inspection-service-order.mapper';

describe('InspectionServiceOrderMapper', () => {
  it('decrypts customer PII and related device addresses', async () => {
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
    const mapper = new InspectionServiceOrderMapper();
    const order = {
      id: 'order-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      customer: {
        id: 'customer-1',
        tenantId: 'tenant-1',
        piiCiphertext: Buffer.from('customer'),
        piiNonce: Buffer.alloc(12),
        piiKeyVersion: 1,
        piiFormatVersion: 1,
      },
      source: ServiceOrderSource.user,
      status: ServiceOrderStatus.scheduled,
      orderDate: new Date('2026-09-01T10:00:00.000Z'),
      scheduledAt: new Date('2027-02-20T08:00:00.000Z'),
      lastMessage: {
        date: new Date('2026-09-02T08:00:00.000Z'),
        confirmationStatus: null,
      },
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
      devices: [
        {
          id: 'device-1',
          brand: 'Daikin',
          model: 'Stylish',
          hasCustomInstallationAddress: true,
          installationAddressCiphertext: Buffer.from('address'),
          installationAddressNonce: Buffer.alloc(12),
          installationAddressKeyVersion: 2,
          installationAddressFormatVersion: 1,
        },
      ],
    };

    const result = await mapper.map(order, piiCipher as never);

    expect(result.serviceData).toMatchObject({
      deviceIds: ['device-1'],
      devices: [
        {
          id: 'device-1',
          address: 'Leśna 2',
          postalCode: '90-001',
          city: 'Łódź',
        },
      ],
      customerConfirmationStatus: 'pending',
      confirmationReminderSentAt: '2026-09-02T08:00:00.000Z',
    });
    expect(piiCipher.decryptJson).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        recordId: 'customer-1',
        purpose: ENCRYPTION_PURPOSES.customerPii,
      }),
    );
    expect(piiCipher.decryptJson).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        recordId: 'device-1',
        purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
      }),
    );

    const withoutMessage = await mapper.map(
      { ...order, lastMessage: null },
      piiCipher as never,
    );
    expect(withoutMessage.serviceData).toMatchObject({
      customerConfirmationStatus: 'not_confirmed',
      confirmationReminderSentAt: null,
    });
  });
});
