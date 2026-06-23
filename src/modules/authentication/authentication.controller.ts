import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { LoginCommand } from './commands/login.command';
import { LogoutCommand } from './commands/logout.command';
import { PinLoginCommand } from './commands/pin-login.command';
import { RefreshCommand } from './commands/refresh.command';
import { AUTH_COOKIE_NAMES } from './authentication.constants';
import {
  AuthenticationUnauthorizedResponseDto,
  AuthenticationRedirectResponseDto,
  AuthenticationSuccessResponseDto,
  LoginRetriesLimitReachedResponseDto,
} from './dto/authentication-response.dto';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import type { RequestWithCookies } from './authentication.types';

@ApiTags('authentication')
@ApiExtraModels(
  AuthenticationUnauthorizedResponseDto,
  LoginRetriesLimitReachedResponseDto,
)
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
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    type: AuthenticationSuccessResponseDto,
    description: 'Authentication cookies were set.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Credentials are invalid or login retry limit has been reached.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AuthenticationUnauthorizedResponseDto) },
        { $ref: getSchemaPath(LoginRetriesLimitReachedResponseDto) },
      ],
    },
  })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.loginCommand.execute(dto, response);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh authentication cookies' })
  @ApiCookieAuth(AUTH_COOKIE_NAMES.refreshToken)
  @ApiCookieAuth(AUTH_COOKIE_NAMES.userId)
  @ApiOkResponse({
    type: AuthenticationSuccessResponseDto,
    description: 'Authentication cookies were refreshed.',
  })
  @ApiResponse({
    status: HttpStatus.LOCKED,
    type: AuthenticationRedirectResponseDto,
    description: 'PIN login is required before refreshing the session.',
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token is missing, invalid, or expired.',
  })
  refresh(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.refreshCommand.execute(request, response);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log out and clear authentication cookies' })
  @ApiCookieAuth(AUTH_COOKIE_NAMES.userId)
  @ApiOkResponse({
    type: AuthenticationSuccessResponseDto,
    description: 'Authentication cookies were cleared.',
  })
  logout(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.logoutCommand.execute(request, response);
  }

  @Post('pin-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unlock session with PIN' })
  @ApiCookieAuth(AUTH_COOKIE_NAMES.refreshToken)
  @ApiCookieAuth(AUTH_COOKIE_NAMES.userId)
  @ApiBody({ type: PinLoginDto })
  @ApiOkResponse({
    type: AuthenticationSuccessResponseDto,
    description: 'Session was unlocked and authentication cookies were set.',
  })
  @ApiUnauthorizedResponse({
    type: AuthenticationRedirectResponseDto,
    description: 'PIN is invalid or login is required again.',
  })
  pinLogin(
    @Body() dto: PinLoginDto,
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.pinLoginCommand.execute(dto, request, response);
  }
}
