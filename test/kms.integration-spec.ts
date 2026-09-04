import 'reflect-metadata';

import { KeyManagementServiceClient } from '@google-cloud/kms';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';

import { GoogleKmsService } from '../src/common/encryption/google-kms.service';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

describe('GoogleKmsService integration', () => {
  const client = new KeyManagementServiceClient();
  const service = new GoogleKmsService(new ConfigService(process.env), client);

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it('wraps and unwraps a tenant DEK using the configured Cloud KMS key', async () => {
    const tenantId = randomUUID();
    const dek = randomBytes(32);
    let unwrapped: Buffer | null = null;

    try {
      const wrapped = await service.wrapDek({
        tenantId,
        keyVersion: 1,
        dek,
      });
      unwrapped = await service.unwrapDek({
        tenantId,
        keyVersion: 1,
        wrappedDek: wrapped.wrappedDek,
        kekKeyName: wrapped.kekKeyName,
      });

      expect(timingSafeEqual(dek, unwrapped)).toBe(true);
    } finally {
      dek.fill(0);
      unwrapped?.fill(0);
    }
  });
});
