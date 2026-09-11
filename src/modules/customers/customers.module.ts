import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthSecurityModule } from '@auth';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { TenantEncryptionModule } from '../tenant-encryption/tenant-encryption.module';
import { CustomersCommandHandlers } from './commands';
import { CustomersController } from './controllers/customers.controller';
import { CustomerEmailLookupService } from './customer-email-lookup.service';
import { CustomersReadRepository } from './infrastructure/customers.read-repository';
import { CustomersRepository } from './infrastructure/customers.repository';
import { CustomersQueryHandlers } from './queries';

@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    AuthSecurityModule,
    TenantEncryptionModule,
  ],
  controllers: [CustomersController],
  providers: [
    CustomersRepository,
    CustomersReadRepository,
    CustomerEmailLookupService,
    ...CustomersCommandHandlers,
    ...CustomersQueryHandlers,
  ],
  exports: [
    CustomersRepository,
    CustomersReadRepository,
    CustomerEmailLookupService,
  ],
})
export class CustomersModule {}
