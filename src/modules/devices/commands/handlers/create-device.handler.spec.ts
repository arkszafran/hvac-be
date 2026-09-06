import { CustomerType, DeviceType } from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import { ApplyDeviceInspectionOperationCommand } from '../../../service-orders/service-orders-device-operation.contract';
import {
  CreateDeviceServiceOrderAction,
  type CreateDeviceDto,
} from '../../dto/create-device.dto';
import { CreateDeviceCommand } from '../impl/create-device.command';
import { CreateDeviceHandler } from './create-device.handler';

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
jest.mock('../../infrastructure/devices.repository', () => ({
  DevicesRepository: jest.fn(),
}));

describe('CreateDeviceHandler', () => {
  it('stores encrypted custom address and dispatches the service-order command in the same transaction', async () => {
    const transaction = { transaction: true };
    const customer = {
      id: 'customer-1',
      tenantId: 'tenant-1',
      type: CustomerType.individual,
      piiCiphertext: Buffer.from('customer'),
      piiNonce: Buffer.alloc(12),
      piiKeyVersion: 1,
      piiFormatVersion: 1,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
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
    const encryptedAddress = {
      ciphertext: Buffer.from('address'),
      nonce: Buffer.alloc(12),
      keyVersion: 2,
      formatVersion: 1,
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: unknown) => unknown) =>
          callback(transaction),
        ),
    };
    let storedInput: { id: string; encryptedInstallationAddress: unknown };
    const devicesRepository = {
      create: jest
        .fn()
        .mockImplementation(
          (input: { id: string; encryptedInstallationAddress: unknown }) => {
            storedInput = input;
            return {
              ...input,
              powerKw: 3.5,
              serialNumber: 'SN-1',
              note: null,
              refrigerant: 'R32',
              refrigerantAmount: '1.2 kg',
              location: 'Recepcja',
              installationAddressCiphertext: encryptedAddress.ciphertext,
              installationAddressNonce: encryptedAddress.nonce,
              installationAddressKeyVersion: encryptedAddress.keyVersion,
              installationAddressFormatVersion: encryptedAddress.formatVersion,
              createdAt: new Date('2026-09-05T10:00:00.000Z'),
              updatedAt: new Date('2026-09-05T10:00:00.000Z'),
            };
          },
        ),
    };
    const deviceCustomersReadRepository = {
      findById: jest.fn().mockResolvedValue(customer),
    };
    const mappedDevice = { id: 'mapped-device' };
    const devicesMapper = {
      decryptCustomer: jest.fn().mockResolvedValue(customerPii),
      mapDevice: jest.fn().mockResolvedValue(mappedDevice),
    };
    const piiCipher = {
      encryptJson: jest.fn().mockResolvedValue(encryptedAddress),
    };
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
    const handler = new CreateDeviceHandler(
      prisma as unknown as ConstructorParameters<typeof CreateDeviceHandler>[0],
      devicesRepository as unknown as ConstructorParameters<
        typeof CreateDeviceHandler
      >[1],
      deviceCustomersReadRepository as unknown as ConstructorParameters<
        typeof CreateDeviceHandler
      >[2],
      devicesMapper as unknown as ConstructorParameters<
        typeof CreateDeviceHandler
      >[3],
      piiCipher as unknown as ConstructorParameters<
        typeof CreateDeviceHandler
      >[4],
      commandBus as unknown as ConstructorParameters<
        typeof CreateDeviceHandler
      >[5],
    );
    const dto: CreateDeviceDto = {
      customerId: 'customer-1',
      type: DeviceType.air_conditioning,
      brand: 'Daikin',
      model: 'Stylish',
      powerKw: 3.5,
      serialNumber: 'SN-1',
      installationDate: '2026-08-20',
      warrantyMonths: 24,
      note: '',
      refrigerant: 'R32',
      refrigerantAmount: '1.2 kg',
      location: 'Recepcja',
      hasCustomInstallationAddress: true,
      address: 'Leśna 2',
      postalCode: '90-001',
      city: 'Łódź',
      serviceOrder: {
        action: CreateDeviceServiceOrderAction.createInspection,
        scheduledAt: '2027-02-20T09:00:00+01:00',
      },
    };

    const result = await handler.execute(
      new CreateDeviceCommand('tenant-1', dto),
    );

    expect(piiCipher.encryptJson).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      recordId: storedInput!.id,
      purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
      value: {
        address: 'Leśna 2',
        postalCode: '90-001',
        city: 'Łódź',
      },
    });
    expect(storedInput!.encryptedInstallationAddress).toBe(encryptedAddress);
    expect(devicesRepository.create).toHaveBeenCalledWith(
      expect.any(Object),
      transaction,
    );
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(ApplyDeviceInspectionOperationCommand),
    );
    expect(nestedCommand!.transaction).toBe(transaction);
    expect(nestedCommand!.context).toEqual({
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      customerType: CustomerType.individual,
      deviceId: storedInput!.id,
    });
    expect(nestedCommand!.operation).toEqual({
      action: 'create_inspection',
      scheduledAt: dto.serviceOrder?.scheduledAt,
    });
    expect(result).toEqual({ success: true, data: { device: mappedDevice } });
  });
});
