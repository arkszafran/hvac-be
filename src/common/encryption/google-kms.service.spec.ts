import { ConfigService } from '@nestjs/config';
import crc32c from 'fast-crc32c';

import { ENCRYPTION_ERROR_CODES } from './encryption.errors';
import { GoogleKmsService } from './google-kms.service';

const keyName =
  'projects/project/locations/europe-central2/keyRings/ring/cryptoKeys/key';
const keyVersionName = `${keyName}/cryptoKeyVersions/1`;

describe('GoogleKmsService', () => {
  let client: {
    encrypt: jest.Mock;
    decrypt: jest.Mock;
    close: jest.Mock;
  };
  let service: GoogleKmsService;

  beforeEach(() => {
    client = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(keyName),
    };
    service = new GoogleKmsService(
      configService as unknown as ConfigService,
      client,
    );
  });

  it('wraps a DEK and validates the KMS response', async () => {
    const dek = Buffer.alloc(32, 3);
    const wrappedDek = Buffer.from('wrapped-dek');
    client.encrypt.mockResolvedValue([
      {
        name: keyVersionName,
        ciphertext: wrappedDek,
        ciphertextCrc32c: { value: crc32c.calculate(wrappedDek) },
        verifiedPlaintextCrc32c: true,
        verifiedAdditionalAuthenticatedDataCrc32c: true,
      },
    ]);

    await expect(
      service.wrapDek({ tenantId: 'tenant-1', keyVersion: 1, dek }),
    ).resolves.toEqual({
      tenantId: 'tenant-1',
      version: 1,
      wrappedDek,
      kekKeyName: keyName,
      kekKeyVersion: keyVersionName,
    });

    expect(client.encrypt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: keyName,
        plaintext: dek,
        plaintextCrc32c: { value: crc32c.calculate(dek) },
      }),
    );
  });

  it('unwraps a DEK and validates its checksum', async () => {
    const dek = Buffer.alloc(32, 4);
    const wrappedDek = Buffer.from('wrapped-dek');
    client.decrypt.mockResolvedValue([
      {
        plaintext: dek,
        plaintextCrc32c: { value: crc32c.calculate(dek) },
      },
    ]);

    await expect(
      service.unwrapDek({
        tenantId: 'tenant-1',
        keyVersion: 1,
        wrappedDek,
        kekKeyName: keyName,
      }),
    ).resolves.toEqual(dek);

    expect(client.decrypt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: keyName,
        ciphertext: wrappedDek,
        ciphertextCrc32c: { value: crc32c.calculate(wrappedDek) },
      }),
    );
  });

  it('rejects a response with an invalid checksum', async () => {
    const wrappedDek = Buffer.from('wrapped-dek');
    client.encrypt.mockResolvedValue([
      {
        name: keyVersionName,
        ciphertext: wrappedDek,
        ciphertextCrc32c: { value: 1 },
        verifiedPlaintextCrc32c: true,
        verifiedAdditionalAuthenticatedDataCrc32c: true,
      },
    ]);

    await expect(
      service.wrapDek({
        tenantId: 'tenant-1',
        keyVersion: 1,
        dek: Buffer.alloc(32),
      }),
    ).rejects.toMatchObject({
      code: ENCRYPTION_ERROR_CODES.kmsIntegrityCheckFailed,
    });
  });

  it('closes the KMS client during module shutdown', async () => {
    await service.onModuleDestroy();

    expect(client.close).toHaveBeenCalledTimes(1);
  });
});
