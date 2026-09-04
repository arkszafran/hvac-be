import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import { RotateTenantDekCommand } from '../impl/rotate-tenant-dek.command';
import { RotateTenantDekHandler } from './rotate-tenant-dek.handler';

jest.mock('../../infrastructure/tenant-encryption-key.repository', () => ({
  TenantEncryptionKeyRepository: jest.fn(),
}));
jest.mock('../../infrastructure/tenant-pii-rotation.repository', () => ({
  TenantPiiRotationRepository: jest.fn(),
}));
jest.mock('../../tenant-key.service', () => ({
  TenantKeyService: jest.fn(),
}));
jest.mock('../../tenant-pii-cipher.service', () => ({
  TenantPiiCipherService: jest.fn(),
}));

describe('RotateTenantDekHandler', () => {
  let keyRepository: {
    findDecryptOnly: jest.Mock;
    findActive: jest.Mock;
    getNextVersion: jest.Mock;
    startRotation: jest.Mock;
    finishRotation: jest.Mock;
  };
  let piiRepository: {
    findNextBatch: jest.Mock;
    updateBatch: jest.Mock;
    countReferences: jest.Mock;
  };
  let keyService: {
    prepareKey: jest.Mock;
    invalidate: jest.Mock;
  };
  let piiCipherService: {
    decryptJson: jest.Mock;
    encryptJsonWithKeyVersion: jest.Mock;
  };
  let handler: RotateTenantDekHandler;

  beforeEach(() => {
    keyRepository = {
      findDecryptOnly: jest.fn().mockResolvedValue(null),
      findActive: jest.fn().mockResolvedValue({ version: 1 }),
      getNextVersion: jest.fn().mockResolvedValue(2),
      startRotation: jest.fn().mockResolvedValue(undefined),
      finishRotation: jest.fn().mockResolvedValue(undefined),
    };
    piiRepository = {
      findNextBatch: jest.fn().mockResolvedValue([]),
      updateBatch: jest.fn().mockResolvedValue(0),
      countReferences: jest.fn().mockResolvedValue(0),
    };
    keyService = {
      prepareKey: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        version: 2,
        wrappedDek: Buffer.from('wrapped'),
        kekKeyName: 'key',
        kekKeyVersion: 'key/cryptoKeyVersions/1',
      }),
      invalidate: jest.fn(),
    };
    piiCipherService = {
      decryptJson: jest.fn(),
      encryptJsonWithKeyVersion: jest.fn(),
    };
    handler = new RotateTenantDekHandler(
      keyRepository as unknown as ConstructorParameters<
        typeof RotateTenantDekHandler
      >[0],
      piiRepository as unknown as ConstructorParameters<
        typeof RotateTenantDekHandler
      >[1],
      keyService as unknown as ConstructorParameters<
        typeof RotateTenantDekHandler
      >[2],
      piiCipherService as unknown as ConstructorParameters<
        typeof RotateTenantDekHandler
      >[3],
    );
  });

  it('creates a new active version and retires the previous one', async () => {
    await expect(
      handler.execute(new RotateTenantDekCommand('tenant-1')),
    ).resolves.toEqual({
      success: true,
      data: {
        tenantId: 'tenant-1',
        previousVersion: 1,
        activeVersion: 2,
        recordsUpdated: 0,
      },
    });

    expect(keyRepository.startRotation).toHaveBeenCalledWith(
      expect.objectContaining({ currentVersion: 1 }),
    );
    expect(keyRepository.finishRotation).toHaveBeenCalledWith('tenant-1', 1);
  });

  it('resumes an interrupted rotation and re-encrypts remaining records', async () => {
    keyRepository.findDecryptOnly.mockResolvedValue({ version: 1 });
    keyRepository.findActive.mockResolvedValue({ version: 2 });
    const record = {
      id: 'customer-1',
      purpose: ENCRYPTION_PURPOSES.customerPii,
      ciphertext: Buffer.from('ciphertext-with-tag'),
      nonce: Buffer.alloc(12),
      keyVersion: 1,
      formatVersion: 1,
    };
    piiRepository.findNextBatch
      .mockResolvedValueOnce([record])
      .mockResolvedValueOnce([]);
    piiRepository.updateBatch.mockResolvedValue(1);
    piiCipherService.decryptJson.mockResolvedValue({ fullName: 'Jan' });
    piiCipherService.encryptJsonWithKeyVersion.mockResolvedValue({
      ciphertext: Buffer.from('new-ciphertext-with-tag'),
      nonce: Buffer.alloc(12, 1),
      keyVersion: 2,
      formatVersion: 1,
    });

    await expect(
      handler.execute(new RotateTenantDekCommand('tenant-1', 50)),
    ).resolves.toMatchObject({
      data: { recordsUpdated: 1, activeVersion: 2 },
    });

    expect(keyService.prepareKey).not.toHaveBeenCalled();
    expect(piiCipherService.decryptJson).toHaveBeenCalledWith(
      expect.objectContaining({ recordId: 'customer-1' }),
    );
    expect(piiRepository.updateBatch).toHaveBeenCalledWith(
      'tenant-1',
      1,
      expect.any(Array),
    );
  });
});
