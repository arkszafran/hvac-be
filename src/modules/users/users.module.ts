import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { MailModule } from '../../common/mail/mail.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { QueuesModule } from '../../common/queues/queues.module';
import { AuthSecurityModule } from '@auth';
import { UsersCommandHandlers } from './commands';
import { UsersController } from './controllers/users.controller';
import { UsersRepository } from './infrastructure/users.repository';
import { TenantUserCreatedMailHandler } from './mails/handlers/tenant-user-created-mail.handler';
import { UsersMailQueueService } from './mails/users-mail-queue.service';
import { UsersMailsHandler } from './mails/users-mails.handler';

@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    QueuesModule,
    MailModule,
    AuthSecurityModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersRepository,
    UsersMailQueueService,
    UsersMailsHandler,
    TenantUserCreatedMailHandler,
    ...UsersCommandHandlers,
  ],
})
export class UsersModule {}
