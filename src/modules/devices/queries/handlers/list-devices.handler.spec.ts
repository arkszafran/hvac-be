import { ConfigService } from '@nestjs/config';
import { CustomerType, DeviceType } from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import { DevicesMapper } from '../../devices.mapper';
import type {
  DeviceCustomerPii,
  StoredDevice,
  StoredDeviceCustomer,
} from '../../devices.types';
import { ListDevicesQuery } from '../impl/list-devices.query';
import { ListDevicesHandler } from './list-devices.handler';

jest.mock('../../infrastructure/devices.read-repository', () => ({
  DevicesReadRepository: jest.fn(),
}));
jest.mock('../../../tenant-encryption/tenant-pii-cipher.service', () => ({
  TenantPiiCipherService: jest.fn(),
}));

describe('ListDevicesHandler', () => {
  const customerOne = storedCustomer('customer-1', CustomerType.company);
  const customerTwo = storedCustomer('customer-2', CustomerType.individual);
  const deviceOne = storedDevice('device-1', 'customer-1', {
    brand: 'Daikin',
    model: 'Stylish',
    location: 'Serwerownia',
    hasCustomInstallationAddress: true,
    installationAddressCiphertext: Buffer.from('address'),
    installationAddressNonce: Buffer.alloc(12),
    installationAddressKeyVersion: 2,
    installationAddressFormatVersion: 1,
  });
  const deviceTwo = storedDevice('device-2', 'customer-2', {
    brand: 'Mitsubishi',
    model: 'Diamond',
    location: 'Salon',
  });
  const storedItems = [
    { device: deviceOne, customer: customerOne },
    { device: deviceTwo, customer: customerTwo },
  ];
  const piiByCustomerId: Record<string, DeviceCustomerPii> = {
    'customer-1': {
      companyName: 'Żuraw Serwis',
      fullName: 'Adam Nowak',
      phone: '111222333',
      email: 'kontakt@zuraw.example.com',
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

  it('returns every device with its customer and effective address in client mode', async () => {
    const { handler } = createHandler(2);

    const result = await handler.execute(
      new ListDevicesQuery('tenant-1', {
        q: 'does-not-match',
        page: 10,
      }),
    );

    expect(result).toEqual({
      success: true,
      data: {
        filteringMode: 'client',
        items: [
          expect.objectContaining({
            id: 'device-1',
            address: 'Łąkowa 5',
            postalCode: '40-001',
            city: 'Katowice',
          }),
          expect.objectContaining({
            id: 'device-2',
            address: 'Długa 2',
            postalCode: '00-002',
            city: 'Warszawa',
          }),
        ],
        totalItems: 2,
      },
    });
    expect(result.data.items[0]?.customer).toMatchObject({ id: 'customer-1' });
    expect(result.data.items[1]?.customer).toMatchObject({ id: 'customer-2' });
  });

  it.each([
    'DAIKIN',
    'stylish',
    'serwerownia',
    'LAKOWA',
    'ZURAW',
    '111222333',
    'kontakt@zuraw.example.com',
    'Piotrkowska',
  ])('searches device and customer fields for %s in server mode', async (q) => {
    const { handler } = createHandler(1);

    const result = await handler.execute(
      new ListDevicesQuery('tenant-1', { q, page: 1 }),
    );

    expect(result).toEqual({
      success: true,
      data: {
        filteringMode: 'server',
        items: [expect.objectContaining({ id: 'device-1' })],
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
    handler: ListDevicesHandler;
  } {
    const devicesReadRepository = {
      findAll: jest.fn().mockResolvedValue(storedItems),
    };
    const piiCipher = {
      decryptJson: jest
        .fn()
        .mockImplementation(
          ({ recordId, purpose }: { recordId: string; purpose: string }) => {
            if (purpose === ENCRYPTION_PURPOSES.deviceInstallationAddress) {
              return Promise.resolve({
                address: 'Łąkowa 5',
                postalCode: '40-001',
                city: 'Katowice',
              });
            }

            return Promise.resolve(piiByCustomerId[recordId]);
          },
        ),
    };
    const configService = new ConfigService({
      DEVICES_CLIENT_FILTERING_LIMIT: String(clientFilteringLimit),
      DEVICES_PAGE_SIZE: '1',
    });

    return {
      handler: new ListDevicesHandler(
        devicesReadRepository as unknown as ConstructorParameters<
          typeof ListDevicesHandler
        >[0],
        new DevicesMapper(),
        piiCipher as unknown as ConstructorParameters<
          typeof ListDevicesHandler
        >[2],
        configService,
      ),
    };
  }
});

function storedCustomer(id: string, type: CustomerType): StoredDeviceCustomer {
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

function storedDevice(
  id: string,
  customerId: string,
  overrides: Partial<StoredDevice> = {},
): StoredDevice {
  return {
    id,
    tenantId: 'tenant-1',
    customerId,
    type: DeviceType.air_conditioning,
    brand: 'Panasonic',
    model: 'Etherea',
    powerKw: 3.5,
    serialNumber: null,
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
    updatedAt: new Date('2026-09-02T10:00:00.000Z'),
    ...overrides,
  };
}
