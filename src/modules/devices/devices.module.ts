import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthSecurityModule } from '@auth';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { ServiceOrdersModule } from '../service-orders/service-orders.module';
import { TenantEncryptionModule } from '../tenant-encryption/tenant-encryption.module';
import { DevicesCommandHandlers } from './commands';
import { DevicesController } from './controllers/devices.controller';
import { DevicesMapper } from './devices.mapper';
import { DeviceCustomersReadRepository } from './infrastructure/device-customers.read-repository';
import { DevicesReadRepository } from './infrastructure/devices.read-repository';
import { DevicesRepository } from './infrastructure/devices.repository';
import { DevicesQueryHandlers } from './queries';

@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    AuthSecurityModule,
    ServiceOrdersModule,
    TenantEncryptionModule,
  ],
  controllers: [DevicesController],
  providers: [
    DevicesRepository,
    DevicesReadRepository,
    DeviceCustomersReadRepository,
    DevicesMapper,
    ...DevicesCommandHandlers,
    ...DevicesQueryHandlers,
  ],
})
export class DevicesModule {}
