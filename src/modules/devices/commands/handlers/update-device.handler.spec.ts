import { CustomerType, DeviceType } from '@generated/prisma/enums';

import { ApplyDeviceInspectionOperationCommand } from '../../../service-orders/service-orders-device-operation.contract';
import { UpdateDeviceServiceOrderAction } from '../../dto/update-device.dto';
import { UpdateDeviceCommand } from '../impl/update-device.command';
import { UpdateDeviceHandler } from './update-device.handler';

jest.mock('../../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('../../infrastructure/device-customers.read-repository', () => ({
  DeviceCustomersReadRepository: jest.fn(),
}));
jest.mock('../../../tenant-encryption/tenant-pii-cipher.service', () => ({
  TenantPiiCipherService: jest.fn(),
}));
jest.mock('../../devices.mapper', () => ({
  DevicesMapper: jest.fn(),
  calculateWarrantyUntil: (date: Date, months: number) =>
    months > 0 ? date : null,
  parseDeviceDate: (value: string) => new Date(`${value}T00:00:00.000Z`),
}));
jest.mock('../../infrastructure/devices.read-repository', () => ({
  DevicesReadRepository: jest.fn(),
}));
jest.mock('../../infrastructure/devices.repository', () => ({
  DevicesRepository: jest.fn(),
}));

describe('UpdateDeviceHandler', () => {
  it('updates the device and dispatches inspection changes in one transaction', async () => {
    const transaction = { transaction: true };
    const currentDevice = {
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
      hasCustomInstallationAddress: false,
      installationAddressCiphertext: null,
      installationAddressNonce: null,
      installationAddressKeyVersion: null,
      installationAddressFormatVersion: null,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    };
    const updatedDevice = {
      ...currentDevice,
      brand: 'Mitsubishi',
      updatedAt: new Date('2026-09-05T10:00:00.000Z'),
    };
    const customer = {
      id: 'customer-1',
      tenantId: 'tenant-1',
      type: CustomerType.individual,
    };
    const customerPii = {
      companyName: '',
      fullName: 'Jan Kowalski',
      phone: '500600700',
      email: 'jan@example.com',
      address: 'Długa 1',
      postalCode: '00-001',
      city: 'Warszawa',
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: unknown) => unknown) =>
          callback(transaction),
        ),
    };
    const devicesRepository = {
      update: jest.fn().mockResolvedValue(updatedDevice),
    };
    const devicesReadRepository = {
      findById: jest.fn().mockResolvedValue(currentDevice),
    };
    const deviceCustomersReadRepository = {
      findById: jest.fn().mockResolvedValue(customer),
    };
    const mappedDevice = { id: 'device-1', brand: 'Mitsubishi' };
    const devicesMapper = {
      decryptCustomer: jest.fn().mockResolvedValue(customerPii),
      mapDevice: jest.fn().mockResolvedValue(mappedDevice),
    };
    const piiCipher = { encryptJson: jest.fn() };
    let nestedCommand: ApplyDeviceInspectionOperationCommand;
    const commandBus = {
      execute: jest
        .fn()
        .mockImplementation(
          (command: ApplyDeviceInspectionOperationCommand) => {
            nestedCommand = command;
            return Promise.resolve(undefined);
          },
        ),
    };
    const handler = new UpdateDeviceHandler(
      prisma as unknown as ConstructorParameters<typeof UpdateDeviceHandler>[0],
      devicesRepository as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[1],
      devicesReadRepository as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[2],
      deviceCustomersReadRepository as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[3],
      devicesMapper as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[4],
      piiCipher as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[5],
      commandBus as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[6],
    );

    const result = await handler.execute(
      new UpdateDeviceCommand('tenant-1', 'device-1', {
        brand: 'Mitsubishi',
        serviceOrder: {
          action: UpdateDeviceServiceOrderAction.detachInspection,
          serviceOrderId: 'order-1',
        },
      }),
    );

    expect(devicesRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'device-1',
        brand: 'Mitsubishi',
        encryptedInstallationAddress: null,
      }),
      transaction,
    );
    expect(nestedCommand!.transaction).toBe(transaction);
    expect(nestedCommand!.context).toEqual({
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      customerType: CustomerType.individual,
      deviceId: 'device-1',
    });
    expect(nestedCommand!.operation).toEqual({
      action: 'detach_inspection',
      serviceOrderId: 'order-1',
    });
    expect(piiCipher.encryptJson).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: { device: mappedDevice } });
  });

  it('removes the custom installation address when explicitly disabled', async () => {
    const transaction = { transaction: true };
    const currentDevice = {
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
      installationAddressKeyVersion: 1,
      installationAddressFormatVersion: 1,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    };
    const updatedDevice = {
      ...currentDevice,
      hasCustomInstallationAddress: false,
      installationAddressCiphertext: null,
      installationAddressNonce: null,
      installationAddressKeyVersion: null,
      installationAddressFormatVersion: null,
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: unknown) => unknown) =>
          callback(transaction),
        ),
    };
    const devicesRepository = {
      update: jest.fn().mockResolvedValue(updatedDevice),
    };
    const devicesReadRepository = {
      findById: jest.fn().mockResolvedValue(currentDevice),
    };
    const deviceCustomersReadRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'customer-1',
        tenantId: 'tenant-1',
        type: CustomerType.individual,
      }),
    };
    const devicesMapper = {
      decryptCustomer: jest.fn().mockResolvedValue({
        companyName: '',
        fullName: 'Jan Kowalski',
        phone: '500600700',
        email: 'jan@example.com',
        address: 'Długa 1',
        postalCode: '00-001',
        city: 'Warszawa',
      }),
      decryptInstallationAddress: jest.fn(),
      mapDevice: jest.fn().mockResolvedValue({ id: 'device-1' }),
    };
    const piiCipher = { encryptJson: jest.fn() };
    const commandBus = { execute: jest.fn() };
    const handler = new UpdateDeviceHandler(
      prisma as unknown as ConstructorParameters<typeof UpdateDeviceHandler>[0],
      devicesRepository as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[1],
      devicesReadRepository as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[2],
      deviceCustomersReadRepository as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[3],
      devicesMapper as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[4],
      piiCipher as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[5],
      commandBus as unknown as ConstructorParameters<
        typeof UpdateDeviceHandler
      >[6],
    );

    await handler.execute(
      new UpdateDeviceCommand('tenant-1', 'device-1', {
        hasCustomInstallationAddress: false,
      }),
    );

    expect(devicesRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        hasCustomInstallationAddress: false,
        encryptedInstallationAddress: null,
      }),
      transaction,
    );
    expect(devicesMapper.decryptInstallationAddress).not.toHaveBeenCalled();
    expect(piiCipher.encryptJson).not.toHaveBeenCalled();
  });
});
