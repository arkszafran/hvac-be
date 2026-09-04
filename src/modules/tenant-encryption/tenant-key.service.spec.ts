import { GoogleKmsService } from '../../common/encryption/google-kms.service';
import { TenantEncryptionKeyRepository } from './infrastructure/tenant-encryption-key.repository';
import { TenantKeyCacheService } from './tenant-key-cache.service';
import { TenantKeyService } from './tenant-key.service';

jest.mock('./infrastructure/tenant-encryption-key.repository', () => ({
  TenantEncryptionKeyRepository: jest.fn(),
}));

describe('TenantKeyService', () => {
  it('creates one 256-bit DEK and clears its plaintext buffer after wrapping', async () => {
    let plaintextDek: Buffer | undefined;
    const kmsService = {
      wrapDek: jest.fn().mockImplementation((input: { dek: Buffer }) => {
        plaintextDek = input.dek;

        return {
          tenantId: 'tenant-1',
          version: 1,
          wrappedDek: Buffer.from('wrapped'),
          kekKeyName: 'key',
          kekKeyVersion: 'key/cryptoKeyVersions/1',
        };
      }),
    };
    const service = new TenantKeyService(
      {} as TenantEncryptionKeyRepository,
      {} as TenantKeyCacheService,
      kmsService as unknown as GoogleKmsService,
    );

    await expect(service.prepareInitialKey('tenant-1')).resolves.toMatchObject({
      tenantId: 'tenant-1',
      version: 1,
    });
    expect(plaintextDek).toHaveLength(32);
    expect(plaintextDek).toEqual(Buffer.alloc(32));
  });
});
