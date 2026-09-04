import { AesGcmCipherService } from './aes-gcm-cipher.service';
import { PII_ENCRYPTION_FORMAT_VERSION } from './encryption.constants';
import { ENCRYPTION_ERROR_CODES, EncryptionError } from './encryption.errors';
import { ENCRYPTION_PURPOSES } from './encryption.types';

describe('AesGcmCipherService', () => {
  const service = new AesGcmCipherService();
  const dek = Buffer.alloc(32, 7);
  const context = {
    tenantId: 'tenant-1',
    purpose: ENCRYPTION_PURPOSES.customerPii,
    recordId: 'customer-1',
    keyVersion: 1,
    formatVersion: PII_ENCRYPTION_FORMAT_VERSION,
  } as const;

  it('encrypts and decrypts a payload without exposing plaintext', () => {
    const plaintext = Buffer.from('sensitive customer data');
    const encrypted = service.encrypt(plaintext, dek, context);

    expect(encrypted.nonce).toHaveLength(12);
    expect(encrypted.ciphertext.includes(plaintext)).toBe(false);
    expect(
      service.decrypt(encrypted.ciphertext, encrypted.nonce, dek, context),
    ).toEqual(plaintext);
  });

  it('generates a fresh nonce for every encryption', () => {
    const plaintext = Buffer.from('same data');
    const first = service.encrypt(plaintext, dek, context);
    const second = service.encrypt(plaintext, dek, context);

    expect(first.nonce).not.toEqual(second.nonce);
    expect(first.ciphertext).not.toEqual(second.ciphertext);
  });

  it('rejects a tampered ciphertext', () => {
    const encrypted = service.encrypt(Buffer.from('data'), dek, context);
    const tampered = Buffer.from(encrypted.ciphertext);
    tampered[0] ^= 1;

    expectAuthenticationFailure(() =>
      service.decrypt(tampered, encrypted.nonce, dek, context),
    );
  });

  it('rejects ciphertext moved to another record through AAD', () => {
    const encrypted = service.encrypt(Buffer.from('data'), dek, context);

    expectAuthenticationFailure(() =>
      service.decrypt(encrypted.ciphertext, encrypted.nonce, dek, {
        ...context,
        recordId: 'customer-2',
      }),
    );
  });

  it('rejects ciphertext moved to another tenant through AAD', () => {
    const encrypted = service.encrypt(Buffer.from('data'), dek, context);

    expectAuthenticationFailure(() =>
      service.decrypt(encrypted.ciphertext, encrypted.nonce, dek, {
        ...context,
        tenantId: 'tenant-2',
      }),
    );
  });
});

function expectAuthenticationFailure(action: () => unknown): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(EncryptionError);

    if (error instanceof EncryptionError) {
      expect(error.code).toBe(ENCRYPTION_ERROR_CODES.authenticationFailed);
    }

    return;
  }

  throw new Error('Expected encrypted payload authentication to fail.');
}
