import { ENCRYPTION_APPLICATION_ID } from './encryption.constants';
import type { EncryptionContext } from './encryption.types';

export function buildEncryptionAad(context: EncryptionContext): Buffer {
  return Buffer.from(
    JSON.stringify({
      application: ENCRYPTION_APPLICATION_ID,
      tenantId: context.tenantId,
      purpose: context.purpose,
      recordId: context.recordId,
      keyVersion: context.keyVersion,
      formatVersion: context.formatVersion,
    }),
    'utf8',
  );
}

export function buildTenantDekAad(
  tenantId: string,
  keyVersion: number,
): Buffer {
  return Buffer.from(
    JSON.stringify({
      application: ENCRYPTION_APPLICATION_ID,
      purpose: 'tenant-dek',
      tenantId,
      keyVersion,
      formatVersion: 1,
    }),
    'utf8',
  );
}
