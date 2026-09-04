import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { EncryptionModule } from '../../common/encryption/encryption.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { TenantEncryptionCommandHandlers } from './commands';
import { TenantEncryptionKeyRepository } from './infrastructure/tenant-encryption-key.repository';
import { TenantPiiRotationRepository } from './infrastructure/tenant-pii-rotation.repository';
import { TenantKeyCacheService } from './tenant-key-cache.service';
import { TenantKeyService } from './tenant-key.service';
import { TenantPiiCipherService } from './tenant-pii-cipher.service';

@Module({
  imports: [CqrsModule, PrismaModule, EncryptionModule],
  providers: [
    TenantEncryptionKeyRepository,
    TenantPiiRotationRepository,
    TenantKeyCacheService,
    TenantKeyService,
    TenantPiiCipherService,
    ...TenantEncryptionCommandHandlers,
  ],
  exports: [TenantKeyService, TenantPiiCipherService],
})
export class TenantEncryptionModule {}
