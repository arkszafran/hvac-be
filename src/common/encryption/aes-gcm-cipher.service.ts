import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import {
  AES_GCM_AUTH_TAG_BYTES,
  AES_GCM_NONCE_BYTES,
  DATA_ENCRYPTION_KEY_BYTES,
} from './encryption.constants';
import { buildEncryptionAad } from './encryption-aad';
import { ENCRYPTION_ERROR_CODES, EncryptionError } from './encryption.errors';
import type { EncryptionContext } from './encryption.types';

@Injectable()
export class AesGcmCipherService {
  encrypt(
    plaintext: Buffer,
    dek: Buffer,
    context: EncryptionContext,
  ): { readonly ciphertext: Buffer; readonly nonce: Buffer } {
    this.assertDek(dek);

    const nonce = randomBytes(AES_GCM_NONCE_BYTES);
    const cipher = createCipheriv('aes-256-gcm', dek, nonce, {
      authTagLength: AES_GCM_AUTH_TAG_BYTES,
    });
    cipher.setAAD(buildEncryptionAad(context));

    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authenticationTag = cipher.getAuthTag();

    return {
      ciphertext: Buffer.concat([encrypted, authenticationTag]),
      nonce,
    };
  }

  decrypt(
    ciphertext: Buffer,
    nonce: Buffer,
    dek: Buffer,
    context: EncryptionContext,
  ): Buffer {
    this.assertDek(dek);

    if (nonce.length !== AES_GCM_NONCE_BYTES) {
      throw new EncryptionError(
        ENCRYPTION_ERROR_CODES.invalidPayload,
        'Encrypted payload has an invalid nonce.',
      );
    }

    if (ciphertext.length < AES_GCM_AUTH_TAG_BYTES) {
      throw new EncryptionError(
        ENCRYPTION_ERROR_CODES.invalidPayload,
        'Encrypted payload is too short.',
      );
    }

    const encrypted = ciphertext.subarray(
      0,
      ciphertext.length - AES_GCM_AUTH_TAG_BYTES,
    );
    const authenticationTag = ciphertext.subarray(
      ciphertext.length - AES_GCM_AUTH_TAG_BYTES,
    );

    try {
      const decipher = createDecipheriv('aes-256-gcm', dek, nonce, {
        authTagLength: AES_GCM_AUTH_TAG_BYTES,
      });
      decipher.setAAD(buildEncryptionAad(context));
      decipher.setAuthTag(authenticationTag);

      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (error) {
      throw new EncryptionError(
        ENCRYPTION_ERROR_CODES.authenticationFailed,
        'Encrypted payload authentication failed.',
        { cause: error },
      );
    }
  }

  private assertDek(dek: Buffer): void {
    if (dek.length !== DATA_ENCRYPTION_KEY_BYTES) {
      throw new EncryptionError(
        ENCRYPTION_ERROR_CODES.invalidKey,
        'Data encryption key has an invalid length.',
      );
    }
  }
}
