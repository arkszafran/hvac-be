import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ENCRYPTION_ERROR_CODES,
  EncryptionError,
} from '../../common/encryption/encryption.errors';

type CacheEntry = {
  readonly dek: Buffer;
  readonly expiresAt: number;
};

@Injectable()
export class TenantKeyCacheService implements OnModuleDestroy {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly ttlMilliseconds: number;
  private readonly maxEntries: number;

  constructor(configService: ConfigService) {
    this.ttlMilliseconds =
      Number(configService.getOrThrow('PII_DEK_CACHE_TTL_SECONDS')) * 1000;
    this.maxEntries = Number(
      configService.getOrThrow('PII_DEK_CACHE_MAX_ENTRIES'),
    );
  }

  async getOrLoad(key: string, loader: () => Promise<Buffer>): Promise<Buffer> {
    const cached = this.get(key);

    if (cached) {
      return cached;
    }

    let loading = this.inFlight.get(key);

    if (!loading) {
      loading = this.load(key, loader);
      this.inFlight.set(key, loading);
    }

    await loading;

    const loaded = this.get(key);

    if (!loaded) {
      throw new EncryptionError(
        ENCRYPTION_ERROR_CODES.tenantKeyMissing,
        'Tenant key was not loaded into the cache.',
      );
    }

    return loaded;
  }

  invalidate(key: string): void {
    const entry = this.cache.get(key);

    if (entry) {
      entry.dek.fill(0);
      this.cache.delete(key);
    }
  }

  onModuleDestroy(): void {
    for (const entry of this.cache.values()) {
      entry.dek.fill(0);
    }

    this.cache.clear();
    this.inFlight.clear();
  }

  private get(key: string): Buffer | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.invalidate(key);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);

    return Buffer.from(entry.dek);
  }

  private async load(
    key: string,
    loader: () => Promise<Buffer>,
  ): Promise<void> {
    let dek: Buffer | null = null;

    try {
      dek = await loader();
      this.set(key, dek);
    } finally {
      dek?.fill(0);
      this.inFlight.delete(key);
    }
  }

  private set(key: string, dek: Buffer): void {
    this.invalidate(key);
    this.cache.set(key, {
      dek: Buffer.from(dek),
      expiresAt: Date.now() + this.ttlMilliseconds,
    });

    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value as string | undefined;

      if (!oldestKey) {
        return;
      }

      this.invalidate(oldestKey);
    }
  }
}
