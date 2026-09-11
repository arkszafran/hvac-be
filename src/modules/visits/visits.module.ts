import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthSecurityModule } from '@auth';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { CustomersModule } from '../customers/customers.module';
import { DevicesModule } from '../devices/devices.module';
import { TenantEncryptionModule } from '../tenant-encryption/tenant-encryption.module';
import { VisitsCommandHandlers } from './commands';
import { VisitsController } from './controllers/visits.controller';
import { VisitsReadRepository } from './infrastructure/visits.read-repository';
import { VisitsRepository } from './infrastructure/visits.repository';
import { VisitsQueryHandlers } from './queries';
import { VisitsMapper } from './visits.mapper';

@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    AuthSecurityModule,
    AttachmentsModule,
    CustomersModule,
    DevicesModule,
    TenantEncryptionModule,
  ],
  controllers: [VisitsController],
  providers: [
    VisitsRepository,
    VisitsReadRepository,
    VisitsMapper,
    ...VisitsCommandHandlers,
    ...VisitsQueryHandlers,
  ],
})
export class VisitsModule {}
