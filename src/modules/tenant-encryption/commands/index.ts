import { RewrapTenantDekHandler } from './handlers/rewrap-tenant-dek.handler';
import { RotateTenantDekHandler } from './handlers/rotate-tenant-dek.handler';

export const TenantEncryptionCommandHandlers = [
  RewrapTenantDekHandler,
  RotateTenantDekHandler,
];
