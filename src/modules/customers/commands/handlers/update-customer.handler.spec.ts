import { CustomerType } from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import { UpdateCustomerCommand } from '../impl/update-customer.command';
import { UpdateCustomerHandler } from './update-customer.handler';

jest.mock('../../../tenant-encryption/tenant-pii-cipher.service', () => ({
  TenantPiiCipherService: jest.fn(),
}));
jest.mock('../../infrastructure/customers.repository', () => ({
  CustomersRepository: jest.fn(),
}));
jest.mock('../../infrastructure/customers.read-repository', () => ({
  CustomersReadRepository: jest.fn(),
}));
jest.mock('../../customer-email-lookup.service', () => ({
  CustomerEmailLookupService: jest.fn(),
}));

describe('UpdateCustomerHandler', () => {
  it('decrypts, merges and re-encrypts the complete PII payload', async () => {
    const currentCustomer = {
      id: 'customer-1',
      tenantId: 'tenant-1',
      type: CustomerType.individual,
      piiCiphertext: Buffer.from('old-ciphertext'),
      piiNonce: Buffer.alloc(12),
      piiKeyVersion: 1,
      piiFormatVersion: 1,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    };
    const updatedMetadata = {
      id: 'customer-1',
      tenantId: 'tenant-1',
      type: CustomerType.individual,
      createdAt: currentCustomer.createdAt,
      updatedAt: new Date('2026-09-04T10:00:00.000Z'),
    };
    const customersReadRepository = {
      findById: jest.fn().mockResolvedValue(currentCustomer),
    };
    const customersRepository = {
      hasEmailLookupHash: jest.fn().mockResolvedValue(false),
      update: jest.fn().mockResolvedValue(updatedMetadata),
    };
    const piiCipher = {
      decryptJson: jest.fn().mockResolvedValue({
        companyName: 'Old Company',
        fullName: 'Jan Kowalski',
        phone: '500600700',
        email: 'jan@example.com',
        address: 'Stara 1',
        postalCode: '00-001',
        city: 'Warszawa',
      }),
      encryptJson: jest.fn().mockResolvedValue({
        ciphertext: Buffer.from('new-ciphertext'),
        nonce: Buffer.alloc(12, 1),
        keyVersion: 2,
        formatVersion: 1,
      }),
    };
    const emailLookupService = {
      create: jest.fn().mockReturnValue({
        hash: Buffer.alloc(32),
        keyVersion: 2,
      }),
    };
    const handler = new UpdateCustomerHandler(
      customersRepository as unknown as ConstructorParameters<
        typeof UpdateCustomerHandler
      >[0],
      customersReadRepository as unknown as ConstructorParameters<
        typeof UpdateCustomerHandler
      >[1],
      piiCipher as unknown as ConstructorParameters<
        typeof UpdateCustomerHandler
      >[2],
      emailLookupService as unknown as ConstructorParameters<
        typeof UpdateCustomerHandler
      >[3],
    );

    const result = await handler.execute(
      new UpdateCustomerCommand('tenant-1', 'customer-1', {
        companyName: null,
        city: 'Łódź',
      }),
    );

    expect(result.data.city).toBe('Łódź');
    expect(emailLookupService.create).toHaveBeenCalledWith(
      'tenant-1',
      'jan@example.com',
    );
    expect(piiCipher.decryptJson).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        recordId: 'customer-1',
        purpose: ENCRYPTION_PURPOSES.customerPii,
      }),
    );
    expect(piiCipher.encryptJson).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      recordId: 'customer-1',
      purpose: ENCRYPTION_PURPOSES.customerPii,
      value: {
        companyName: null,
        fullName: 'Jan Kowalski',
        phone: '500600700',
        email: 'jan@example.com',
        address: 'Stara 1',
        postalCode: '00-001',
        city: 'Łódź',
      },
    });
    expect(customersRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        id: 'customer-1',
      }),
    );
  });
});
