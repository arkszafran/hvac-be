import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { DATA_ENCRYPTION_KEY_BYTES } from '../../common/encryption/encryption.constants';
import {
  ENCRYPTION_ERROR_CODES,
  EncryptionError,
} from '../../common/encryption/encryption.errors';
import type { WrappedTenantDek } from '../../common/encryption/encryption.types';
import { GoogleKmsService } from '../../common/encryption/google-kms.service';
import { TenantEncryptionKeyRepository } from './infrastructure/tenant-encryption-key.repository';
import { TenantKeyCacheService } from './tenant-key-cache.service';

@Injectable()
export class TenantKeyService {
  constructor(
    private readonly repository: TenantEncryptionKeyRepository,
    private readonly cache: TenantKeyCacheService,
    private readonly kmsService: GoogleKmsService,
  ) {}

  prepareInitialKey(tenantId: string): Promise<WrappedTenantDek> {
    return this.prepareKey(tenantId, 1);
  }

  async prepareKey(
    tenantId: string,
    version: number,
  ): Promise<WrappedTenantDek> {
    const dek = randomBytes(DATA_ENCRYPTION_KEY_BYTES);

    try {
      return await this.kmsService.wrapDek({
        tenantId,
        keyVersion: version,
        dek,
      });
    } finally {
      dek.fill(0);
    }
  }

  async getActiveDek(
    tenantId: string,
  ): Promise<{ readonly version: number; readonly dek: Buffer }> {
    const key = await this.repository.findActive(tenantId);

    if (!key) {
      throw this.missingKeyError();
    }

    return {
      version: key.version,
      dek: await this.getDek(tenantId, key.version),
    };
  }

  getDek(tenantId: string, version: number): Promise<Buffer> {
    return this.cache.getOrLoad(this.cacheKey(tenantId, version), async () => {
      const key = await this.repository.findByVersion(tenantId, version);

      if (!key) {
        throw this.missingKeyError();
      }

      return this.kmsService.unwrapDek({
        tenantId,
        keyVersion: version,
        wrappedDek: key.wrappedDek,
        kekKeyName: key.kekKeyName,
      });
    });
  }

  async rewrapKey(tenantId: string, version: number): Promise<void> {
    const dek = await this.getDek(tenantId, version);

    try {
      const wrapped = await this.kmsService.wrapDek({
        tenantId,
        keyVersion: version,
        dek,
      });
      await this.repository.updateWrappedDek(wrapped);
    } finally {
      dek.fill(0);
    }
  }

  invalidate(tenantId: string, version: number): void {
    this.cache.invalidate(this.cacheKey(tenantId, version));
  }

  private cacheKey(tenantId: string, version: number): string {
    return `${tenantId}:${version}`;
  }

  private missingKeyError(): EncryptionError {
    return new EncryptionError(
      ENCRYPTION_ERROR_CODES.tenantKeyMissing,
      'Tenant encryption key does not exist.',
    );
  }
}
