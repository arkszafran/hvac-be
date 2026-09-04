import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import crc32c from 'fast-crc32c';

import { DATA_ENCRYPTION_KEY_BYTES } from './encryption.constants';
import { buildTenantDekAad } from './encryption-aad';
import { ENCRYPTION_ERROR_CODES, EncryptionError } from './encryption.errors';
import type { WrappedTenantDek } from './encryption.types';

export const KMS_CLIENT = Symbol('KMS_CLIENT');

type KmsClient = Pick<
  KeyManagementServiceClient,
  'encrypt' | 'decrypt' | 'close'
>;

@Injectable()
export class GoogleKmsService implements OnModuleDestroy {
  private readonly configuredKekKeyName: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(KMS_CLIENT) private readonly client: KmsClient,
  ) {
    this.configuredKekKeyName = this.configService
      .getOrThrow<string>('GCP_KMS_KEY_NAME')
      .trim();
  }

  async wrapDek(input: {
    readonly tenantId: string;
    readonly keyVersion: number;
    readonly dek: Buffer;
  }): Promise<WrappedTenantDek> {
    if (input.dek.length !== DATA_ENCRYPTION_KEY_BYTES) {
      throw new EncryptionError(
        ENCRYPTION_ERROR_CODES.invalidKey,
        'Data encryption key has an invalid length.',
      );
    }

    const aad = buildTenantDekAad(input.tenantId, input.keyVersion);

    try {
      const [response] = await this.client.encrypt({
        name: this.configuredKekKeyName,
        plaintext: input.dek,
        additionalAuthenticatedData: aad,
        plaintextCrc32c: { value: crc32c.calculate(input.dek) },
        additionalAuthenticatedDataCrc32c: {
          value: crc32c.calculate(aad),
        },
      });

      if (
        response.verifiedPlaintextCrc32c !== true ||
        response.verifiedAdditionalAuthenticatedDataCrc32c !== true
      ) {
        throw this.integrityError();
      }

      const ciphertext = response.ciphertext
        ? Buffer.from(response.ciphertext)
        : null;
      const kekKeyVersion = response.name;

      if (!ciphertext?.length || !kekKeyVersion) {
        throw this.integrityError();
      }

      if (
        this.crcValue(response.ciphertextCrc32c) !==
        crc32c.calculate(ciphertext)
      ) {
        throw this.integrityError();
      }

      const versionPrefix = `${this.configuredKekKeyName}/cryptoKeyVersions/`;

      if (!kekKeyVersion.startsWith(versionPrefix)) {
        throw this.integrityError();
      }

      return {
        tenantId: input.tenantId,
        version: input.keyVersion,
        wrappedDek: ciphertext,
        kekKeyName: this.configuredKekKeyName,
        kekKeyVersion,
      };
    } catch (error) {
      this.rethrowKmsError(error, 'KMS failed to wrap a tenant key.');
    }
  }

  async unwrapDek(input: {
    readonly tenantId: string;
    readonly keyVersion: number;
    readonly wrappedDek: Buffer;
    readonly kekKeyName: string;
  }): Promise<Buffer> {
    const aad = buildTenantDekAad(input.tenantId, input.keyVersion);

    try {
      const [response] = await this.client.decrypt({
        name: input.kekKeyName,
        ciphertext: input.wrappedDek,
        additionalAuthenticatedData: aad,
        ciphertextCrc32c: { value: crc32c.calculate(input.wrappedDek) },
        additionalAuthenticatedDataCrc32c: {
          value: crc32c.calculate(aad),
        },
      });
      const dek = response.plaintext ? Buffer.from(response.plaintext) : null;

      if (
        !dek ||
        dek.length !== DATA_ENCRYPTION_KEY_BYTES ||
        this.crcValue(response.plaintextCrc32c) !== crc32c.calculate(dek)
      ) {
        throw this.integrityError();
      }

      return dek;
    } catch (error) {
      this.rethrowKmsError(error, 'KMS failed to unwrap a tenant key.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  private crcValue(value: { value?: unknown } | null | undefined): number {
    if (value?.value === undefined || value.value === null) {
      return Number.NaN;
    }

    return Number(value.value);
  }

  private integrityError(): EncryptionError {
    return new EncryptionError(
      ENCRYPTION_ERROR_CODES.kmsIntegrityCheckFailed,
      'KMS response integrity validation failed.',
    );
  }

  private rethrowKmsError(error: unknown, message: string): never {
    if (error instanceof EncryptionError) {
      throw error;
    }

    throw new EncryptionError(ENCRYPTION_ERROR_CODES.kmsUnavailable, message, {
      cause: error,
    });
  }
}
