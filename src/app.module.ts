import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './common/config/env.validation';
import { QueuesModule } from './common/queues/queues.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { OriginGuard } from './common/security/origin/origin.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: process.env.NODE_ENV === 'production' ? undefined : '.env',
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS),
        limit: Number(process.env.THROTTLE_LIMIT),
      },
    ]),
    QueuesModule,
    AuthenticationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: OriginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
