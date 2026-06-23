import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationSessionService } from './authentication-session.service';
import { AuthenticationTokenService } from './authentication-token.service';
import { LoginCommand } from './commands/login.command';
import { LogoutCommand } from './commands/logout.command';
import { PinLoginCommand } from './commands/pin-login.command';
import { RefreshCommand } from './commands/refresh.command';

@Module({
  imports: [PrismaModule, PassportModule, JwtModule.register({})],
  controllers: [AuthenticationController],
  providers: [
    AuthenticationTokenService,
    AuthenticationSessionService,
    LoginCommand,
    RefreshCommand,
    LogoutCommand,
    PinLoginCommand,
  ],
})
export class AuthenticationModule {}
