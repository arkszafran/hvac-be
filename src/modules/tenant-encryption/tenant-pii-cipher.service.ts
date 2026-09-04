import { Injectable } from '@nestjs/common';

import { AesGcmCipherService } from '../../common/encryption/aes-gcm-cipher.service';
import { PII_ENCRYPTION_FORMAT_VERSION } from '../../common/encryption/encryption.constants';
import {
  ENCRYPTION_ERROR_CODES,
  EncryptionError,
} from '../../common/encryption/encryption.errors';
import type {
  EncryptedPayload,
  EncryptionPurpose,
} from '../../common/encryption/encryption.types';
import { TenantKeyService } from './tenant-key.service';

@Injectable()
export class TenantPiiCipherService {
  constructor(
    private readonly tenantKeyService: TenantKeyService,
    private readonly cipherService: AesGcmCipherService,
  ) {}

  async encryptJson(input: {
    readonly tenantId: string;
    readonly purpose: EncryptionPurpose;
    readonly recordId: string;
    readonly value: unknown;
  }): Promise<EncryptedPayload> {
    const { version, dek } = await this.tenantKeyService.getActiveDek(
      input.tenantId,
    );

    return this.encryptJsonWithDek(input, version, dek);
  }

  async encryptJsonWithKeyVersion(input: {
    readonly tenantId: string;
    readonly purpose: EncryptionPurpose;
    readonly recordId: string;
    readonly keyVersion: number;
    readonly value: unknown;
  }): Promise<EncryptedPayload> {
    const dek = await this.tenantKeyService.getDek(
      input.tenantId,
      input.keyVersion,
    );

    return this.encryptJsonWithDek(input, input.keyVersion, dek);
  }

  private encryptJsonWithDek(
    input: {
      readonly tenantId: string;
      readonly purpose: EncryptionPurpose;
      readonly recordId: string;
      readonly value: unknown;
    },
    keyVersion: number,
    dek: Buffer,
  ): EncryptedPayload {
    let plaintext: Buffer | null = null;

    try {
      let serialized: string | undefined;

      try {
        serialized = JSON.stringify(input.value);
      } catch (error) {
        throw new EncryptionError(
          ENCRYPTION_ERROR_CODES.invalidPayload,
          'PII payload cannot be serialized.',
          { cause: error },
        );
      }

      if (serialized === undefined) {
        throw new EncryptionError(
          ENCRYPTION_ERROR_CODES.invalidPayload,
          'PII payload cannot be serialized.',
        );
      }

      plaintext = Buffer.from(serialized, 'utf8');
      const encrypted = this.cipherService.encrypt(plaintext, dek, {
        tenantId: input.tenantId,
        purpose: input.purpose,
        recordId: input.recordId,
        keyVersion,
        formatVersion: PII_ENCRYPTION_FORMAT_VERSION,
      });

      return {
        ...encrypted,
        keyVersion,
        formatVersion: PII_ENCRYPTION_FORMAT_VERSION,
      };
    } finally {
      plaintext?.fill(0);
      dek.fill(0);
    }
  }

  async decryptJson(input: {
    readonly tenantId: string;
    readonly purpose: EncryptionPurpose;
    readonly recordId: string;
    readonly encrypted: EncryptedPayload;
  }): Promise<unknown> {
    if (input.encrypted.formatVersion !== PII_ENCRYPTION_FORMAT_VERSION) {
      throw new EncryptionError(
        ENCRYPTION_ERROR_CODES.unsupportedFormat,
        'PII payload uses an unsupported encryption format.',
      );
    }

    const dek = await this.tenantKeyService.getDek(
      input.tenantId,
      input.encrypted.keyVersion,
    );

    try {
      const plaintext = this.cipherService.decrypt(
        input.encrypted.ciphertext,
        input.encrypted.nonce,
        dek,
        {
          tenantId: input.tenantId,
          purpose: input.purpose,
          recordId: input.recordId,
          keyVersion: input.encrypted.keyVersion,
          formatVersion: input.encrypted.formatVersion,
        },
      );

      try {
        return JSON.parse(plaintext.toString('utf8')) as unknown;
      } catch (error) {
        throw new EncryptionError(
          ENCRYPTION_ERROR_CODES.invalidPayload,
          'Decrypted PII payload is not valid JSON.',
          { cause: error },
        );
      } finally {
        plaintext.fill(0);
      }
    } finally {
      dek.fill(0);
    }
  }
}
