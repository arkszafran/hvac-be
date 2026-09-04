import { AesGcmCipherService } from '../../common/encryption/aes-gcm-cipher.service';
import { ENCRYPTION_ERROR_CODES } from '../../common/encryption/encryption.errors';
import { ENCRYPTION_PURPOSES } from '../../common/encryption/encryption.types';
import { TenantKeyService } from './tenant-key.service';
import { TenantPiiCipherService } from './tenant-pii-cipher.service';

jest.mock('./tenant-key.service', () => ({
  TenantKeyService: jest.fn(),
}));

describe('TenantPiiCipherService', () => {
  const dek = Buffer.alloc(32, 9);
  let keyService: {
    getActiveDek: jest.Mock;
    getDek: jest.Mock;
  };
  let service: TenantPiiCipherService;

  beforeEach(() => {
    keyService = {
      getActiveDek: jest.fn().mockImplementation(() => ({
        version: 1,
        dek: Buffer.from(dek),
      })),
      getDek: jest.fn().mockImplementation(() => Buffer.from(dek)),
    };
    service = new TenantPiiCipherService(
      keyService as unknown as TenantKeyService,
      new AesGcmCipherService(),
    );
  });

  it('round-trips JSON using the stored key and format versions', async () => {
    const value = { fullName: 'Jan Kowalski', email: 'jan@example.com' };
    const encrypted = await service.encryptJson({
      tenantId: 'tenant-1',
      purpose: ENCRYPTION_PURPOSES.customerPii,
      recordId: 'customer-1',
      value,
    });

    await expect(
      service.decryptJson({
        tenantId: 'tenant-1',
        purpose: ENCRYPTION_PURPOSES.customerPii,
        recordId: 'customer-1',
        encrypted,
      }),
    ).resolves.toEqual(value);
    expect(keyService.getDek).toHaveBeenCalledWith('tenant-1', 1);
  });

  it('fails when encrypted JSON is assigned to another entity', async () => {
    const encrypted = await service.encryptJson({
      tenantId: 'tenant-1',
      purpose: ENCRYPTION_PURPOSES.customerPii,
      recordId: 'customer-1',
      value: { fullName: 'Jan Kowalski' },
    });

    await expect(
      service.decryptJson({
        tenantId: 'tenant-1',
        purpose: ENCRYPTION_PURPOSES.serviceOrderCustomerSnapshot,
        recordId: 'customer-1',
        encrypted,
      }),
    ).rejects.toMatchObject({
      code: ENCRYPTION_ERROR_CODES.authenticationFailed,
    });
  });

  it('rejects an unknown payload format before loading a key', async () => {
    await expect(
      service.decryptJson({
        tenantId: 'tenant-1',
        purpose: ENCRYPTION_PURPOSES.customerPii,
        recordId: 'customer-1',
        encrypted: {
          ciphertext: Buffer.alloc(16),
          nonce: Buffer.alloc(12),
          keyVersion: 1,
          formatVersion: 99,
        },
      }),
    ).rejects.toMatchObject({
      code: ENCRYPTION_ERROR_CODES.unsupportedFormat,
    });
    expect(keyService.getDek).not.toHaveBeenCalled();
  });
});
