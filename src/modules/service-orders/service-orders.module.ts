import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthSecurityModule } from '@auth';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { TenantEncryptionModule } from '../tenant-encryption/tenant-encryption.module';
import { ServiceOrdersCommandHandlers } from './commands';
import { ServiceOrdersController } from './controllers/service-orders.controller';
import { InspectionServiceOrderMapper } from './inspection-service-order.mapper';
import { ServiceOrdersReadRepository } from './infrastructure/service-orders.read-repository';
import { ServiceOrdersRepository } from './infrastructure/service-orders.repository';
import { ServiceOrdersQueryHandlers } from './queries';

@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    AuthSecurityModule,
    TenantEncryptionModule,
  ],
  controllers: [ServiceOrdersController],
  providers: [
    ServiceOrdersRepository,
    ServiceOrdersReadRepository,
    InspectionServiceOrderMapper,
    ...ServiceOrdersCommandHandlers,
    ...ServiceOrdersQueryHandlers,
  ],
})
export class ServiceOrdersModule {}
