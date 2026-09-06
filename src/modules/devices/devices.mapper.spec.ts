import { CustomerType, DeviceType } from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../common/encryption/encryption.types';
import { calculateWarrantyUntil, DevicesMapper } from './devices.mapper';

describe('DevicesMapper', () => {
  it('decrypts a custom installation address with tenant and device AAD', async () => {
    const piiCipher = {
      decryptJson: jest.fn().mockResolvedValue({
        address: 'Leśna 2',
        postalCode: '90-001',
        city: 'Łódź',
      }),
    };
    const device = {
      id: 'device-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      type: DeviceType.air_conditioning,
      brand: 'Daikin',
      model: 'Stylish',
      powerKw: 3.5,
      serialNumber: 'SN-1',
      installationDate: new Date('2026-08-20T00:00:00.000Z'),
      warrantyMonths: 24,
      warrantyUntil: new Date('2028-08-20T00:00:00.000Z'),
      note: null,
      refrigerant: 'R32',
      refrigerantAmount: '1.2 kg',
      location: 'Recepcja',
      hasCustomInstallationAddress: true,
      installationAddressCiphertext: Buffer.from('address'),
      installationAddressNonce: Buffer.alloc(12),
      installationAddressKeyVersion: 2,
      installationAddressFormatVersion: 1,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    };
    const mapper = new DevicesMapper();

    const result = await mapper.mapDevice(device, piiCipher as never);

    expect(piiCipher.decryptJson).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      recordId: 'device-1',
      purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
      encrypted: {
        ciphertext: device.installationAddressCiphertext,
        nonce: device.installationAddressNonce,
        keyVersion: 2,
        formatVersion: 1,
      },
    });
    expect(result).toMatchObject({
      id: 'device-1',
      address: 'Leśna 2',
      postalCode: '90-001',
      city: 'Łódź',
    });
  });

  it('maps an empty installation address when a custom address is disabled', async () => {
    const mapper = new DevicesMapper();
    const piiCipher = { decryptJson: jest.fn() };
    const device = {
      id: 'device-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      type: DeviceType.air_conditioning,
      brand: 'Daikin',
      model: 'Stylish',
      powerKw: 3.5,
      serialNumber: 'SN-1',
      installationDate: null,
      warrantyMonths: 0,
      warrantyUntil: null,
      note: null,
      refrigerant: null,
      refrigerantAmount: null,
      location: null,
      hasCustomInstallationAddress: false,
      installationAddressCiphertext: null,
      installationAddressNonce: null,
      installationAddressKeyVersion: null,
      installationAddressFormatVersion: null,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    };

    const result = await mapper.mapDevice(device, piiCipher as never);

    expect(result).toMatchObject({
      hasCustomInstallationAddress: false,
      address: '',
      postalCode: '',
      city: '',
    });
    expect(piiCipher.decryptJson).not.toHaveBeenCalled();
  });

  it('maps the decrypted customer summary', () => {
    const mapper = new DevicesMapper();
    const customer = {
      id: 'customer-1',
      tenantId: 'tenant-1',
      type: CustomerType.individual,
    };

    expect(
      mapper.mapCustomer(customer as never, {
        companyName: '',
        fullName: 'Jan Kowalski',
        phone: '500600700',
        email: 'jan@example.com',
        address: 'Długa 1',
        postalCode: '00-001',
        city: 'Warszawa',
      }),
    ).toMatchObject({ id: 'customer-1', fullName: 'Jan Kowalski' });
  });

  it('calculates warranty end and handles a disabled warranty', () => {
    expect(
      calculateWarrantyUntil(new Date('2027-01-31T00:00:00.000Z'), 1)
        ?.toISOString()
        .slice(0, 10),
    ).toBe('2027-02-28');
    expect(
      calculateWarrantyUntil(new Date('2027-01-31T00:00:00.000Z'), 0),
    ).toBeNull();
  });
});
