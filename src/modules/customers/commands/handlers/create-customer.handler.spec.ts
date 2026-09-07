import { CustomerType } from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import { CreateCustomerCommand } from '../impl/create-customer.command';
import { CreateCustomerHandler } from './create-customer.handler';

jest.mock('../../../tenant-encryption/tenant-pii-cipher.service', () => ({
  TenantPiiCipherService: jest.fn(),
}));
jest.mock('../../infrastructure/customers.repository', () => ({
  CustomersRepository: jest.fn(),
}));
jest.mock('../../customer-email-lookup.service', () => ({
  CustomerEmailLookupService: jest.fn(),
}));

describe('CreateCustomerHandler', () => {
  it('encrypts PII and stores the email HMAC without persisting plaintext', async () => {
    const encryptedPii = {
      ciphertext: Buffer.from('ciphertext'),
      nonce: Buffer.alloc(12),
      keyVersion: 2,
      formatVersion: 1,
    };
    const emailLookupHash = Buffer.alloc(32, 7);
    const customersRepository = {
      generateId: jest.fn().mockResolvedValue('customer-1'),
      hasEmailLookupHash: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockImplementation((input: { id: string }) => ({
        id: input.id,
        tenantId: 'tenant-1',
        type: CustomerType.company,
        createdAt: new Date('2026-09-04T10:00:00.000Z'),
        updatedAt: new Date('2026-09-04T10:00:00.000Z'),
      })),
    };
    const piiCipher = {
      encryptJson: jest.fn().mockResolvedValue(encryptedPii),
    };
    const emailLookupService = {
      create: jest.fn().mockReturnValue({
        hash: emailLookupHash,
        keyVersion: 4,
      }),
    };
    const handler = new CreateCustomerHandler(
      customersRepository as unknown as ConstructorParameters<
        typeof CreateCustomerHandler
      >[0],
      piiCipher as unknown as ConstructorParameters<
        typeof CreateCustomerHandler
      >[1],
      emailLookupService as unknown as ConstructorParameters<
        typeof CreateCustomerHandler
      >[2],
    );
    const dto = {
      type: CustomerType.company,
      companyName: 'Klimat Sp. z o.o.',
      fullName: 'Jan Kowalski',
      phone: '+48 500 600 700',
      email: 'Jan.Kowalski@Example.com',
      address: 'Długa 1',
      postalCode: '00-001',
      city: 'Warszawa',
    };

    const result = await handler.execute(
      new CreateCustomerCommand('tenant-1', dto),
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        type: CustomerType.company,
        email: 'Jan.Kowalski@Example.com',
        companyName: 'Klimat Sp. z o.o.',
      },
    });
    expect(piiCipher.encryptJson).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      recordId: result.data.id,
      purpose: ENCRYPTION_PURPOSES.customerPii,
      value: {
        companyName: dto.companyName,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        postalCode: dto.postalCode,
        city: dto.city,
      },
    });
    expect(emailLookupService.create).toHaveBeenCalledWith(
      'tenant-1',
      'Jan.Kowalski@Example.com',
    );
    expect(customersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        encryptedPii,
        emailLookupHash,
        emailLookupKeyVersion: 4,
      }),
    );
  });

  it('allows names to be omitted and stores them as null', async () => {
    const encryptedPii = {
      ciphertext: Buffer.from('ciphertext'),
      nonce: Buffer.alloc(12),
      keyVersion: 2,
      formatVersion: 1,
    };
    const customersRepository = {
      generateId: jest.fn().mockResolvedValue('customer-1'),
      hasEmailLookupHash: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockImplementation((input: { id: string }) => ({
        id: input.id,
        tenantId: 'tenant-1',
        type: CustomerType.individual,
        createdAt: new Date('2026-09-04T10:00:00.000Z'),
        updatedAt: new Date('2026-09-04T10:00:00.000Z'),
      })),
    };
    const piiCipher = {
      encryptJson: jest.fn().mockResolvedValue(encryptedPii),
    };
    const emailLookupService = {
      create: jest.fn().mockReturnValue({
        hash: Buffer.alloc(32),
        keyVersion: 4,
      }),
    };
    const handler = new CreateCustomerHandler(
      customersRepository as unknown as ConstructorParameters<
        typeof CreateCustomerHandler
      >[0],
      piiCipher as unknown as ConstructorParameters<
        typeof CreateCustomerHandler
      >[1],
      emailLookupService as unknown as ConstructorParameters<
        typeof CreateCustomerHandler
      >[2],
    );

    const result = await handler.execute(
      new CreateCustomerCommand('tenant-1', {
        type: CustomerType.individual,
        phone: '500600700',
        email: 'jan@example.com',
        address: 'Długa 1',
        postalCode: '00-001',
        city: 'Warszawa',
      }),
    );

    expect(result.data).toMatchObject({ companyName: null, fullName: null });
    expect(piiCipher.encryptJson).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      recordId: 'customer-1',
      purpose: ENCRYPTION_PURPOSES.customerPii,
      value: {
        companyName: null,
        fullName: null,
        phone: '500600700',
        email: 'jan@example.com',
        address: 'Długa 1',
        postalCode: '00-001',
        city: 'Warszawa',
      },
    });
  });
});
