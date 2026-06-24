import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { MailModule } from '../../common/mail/mail.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { QueuesModule } from '../../common/queues/queues.module';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationSessionService } from './authentication-session.service';
import { AuthenticationTokenService } from './authentication-token.service';
import { LoginCommand } from './commands/login.command';
import { LogoutCommand } from './commands/logout.command';
import { PinLoginCommand } from './commands/pin-login.command';
import { RefreshCommand } from './commands/refresh.command';
import { UnlockAccountCommand } from './commands/unlock-account.command';
import { AccountUnlockMailHandler } from './mails/handlers/account-unlock-mail.handler';
import { AuthenticationMailQueueService } from './mails/authentication-mail-queue.service';
import { AuthenticationMailsHandler } from './mails/authentication-mails.handler';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({}),
    QueuesModule,
    MailModule,
  ],
  controllers: [AuthenticationController],
  providers: [
    AuthenticationTokenService,
    AuthenticationSessionService,
    LoginCommand,
    RefreshCommand,
    LogoutCommand,
    PinLoginCommand,
    UnlockAccountCommand,
    AuthenticationMailQueueService,
    AuthenticationMailsHandler,
    AccountUnlockMailHandler,
  ],
})
export class AuthenticationModule {}
