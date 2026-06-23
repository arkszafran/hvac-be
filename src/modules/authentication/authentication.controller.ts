import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';

import { LoginCommand } from './commands/login.command';
import { LogoutCommand } from './commands/logout.command';
import { PinLoginCommand } from './commands/pin-login.command';
import { RefreshCommand } from './commands/refresh.command';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import type { RequestWithCookies } from './authentication.types';

@Controller('authentication')
export class AuthenticationController {
  constructor(
    private readonly loginCommand: LoginCommand,
    private readonly refreshCommand: RefreshCommand,
    private readonly logoutCommand: LogoutCommand,
    private readonly pinLoginCommand: PinLoginCommand,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.loginCommand.execute(dto, response);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.refreshCommand.execute(request, response);
  }

  @Post('logout')
  @HttpCode(200)
  logout(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.logoutCommand.execute(request, response);
  }

  @Post('pin-login')
  @HttpCode(200)
  pinLogin(
    @Body() dto: PinLoginDto,
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.pinLoginCommand.execute(dto, request, response);
  }
}
