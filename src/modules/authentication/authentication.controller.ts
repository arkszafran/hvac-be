import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiBadRequestResponse,
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
import { RequestPasswordResetCommand } from './commands/request-password-reset.command';
import { ResetPasswordCommand } from './commands/reset-password.command';
import { UnlockAccountCommand } from './commands/unlock-account.command';
import { AUTH_COOKIE_NAMES } from './authentication.constants';
import {
  AuthenticationErrorResponseDto,
  AuthenticationRedirectErrorResponseDto,
  AuthenticationSessionResponseDto,
  AuthenticationSuccessResponseDto,
  LoginRetriesLimitReachedResponseDto,
} from './dto/authentication-response.dto';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UnlockAccountDto } from './dto/unlock-account.dto';
import { GetSessionQuery } from './queries/impl/get-session.query';
import type { RequestWithCookies } from './authentication.types';

@ApiTags('authentication')
@ApiExtraModels(
  AuthenticationErrorResponseDto,
  AuthenticationRedirectErrorResponseDto,
  LoginRetriesLimitReachedResponseDto,
)
@Controller('authentication')
export class AuthenticationController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly loginCommand: LoginCommand,
    private readonly refreshCommand: RefreshCommand,
    private readonly logoutCommand: LogoutCommand,
    private readonly pinLoginCommand: PinLoginCommand,
    private readonly unlockAccountCommand: UnlockAccountCommand,
    private readonly requestPasswordResetCommand: RequestPasswordResetCommand,
    private readonly resetPasswordCommand: ResetPasswordCommand,
  ) {}

  @Get('session')
  @ApiOperation({ summary: 'Get current authenticated user session' })
  @ApiCookieAuth(AUTH_COOKIE_NAMES.accessToken)
  @ApiCookieAuth(AUTH_COOKIE_NAMES.refreshToken)
  @ApiCookieAuth(AUTH_COOKIE_NAMES.userId)
  @ApiOkResponse({
    type: AuthenticationSessionResponseDto,
    description: 'Current user session was returned.',
  })
  @ApiResponse({
    status: HttpStatus.LOCKED,
    type: AuthenticationRedirectErrorResponseDto,
    description: 'PIN login is required before restoring the session.',
  })
  @ApiUnauthorizedResponse({
    type: AuthenticationErrorResponseDto,
    description: 'Authentication token is missing, invalid, or expired.',
  })
  session(@Req() request: RequestWithCookies) {
    return this.queryBus.execute(new GetSessionQuery(request));
  }

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
        { $ref: getSchemaPath(AuthenticationErrorResponseDto) },
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
    type: AuthenticationRedirectErrorResponseDto,
    description: 'PIN login is required before refreshing the session.',
  })
  @ApiUnauthorizedResponse({
    type: AuthenticationErrorResponseDto,
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
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AuthenticationErrorResponseDto) },
        { $ref: getSchemaPath(AuthenticationRedirectErrorResponseDto) },
      ],
    },
    description: 'PIN is invalid or login is required again.',
  })
  pinLogin(
    @Body() dto: PinLoginDto,
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.pinLoginCommand.execute(dto, request, response);
  }

  @Post('account-unlock')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unlock blocked account with email code' })
  @ApiBody({ type: UnlockAccountDto })
  @ApiOkResponse({
    type: AuthenticationSuccessResponseDto,
    description: 'Account was unlocked.',
  })
  @ApiBadRequestResponse({
    type: AuthenticationErrorResponseDto,
    description: 'Account unlock code is missing or invalid.',
  })
  unlockAccount(@Body() dto: UnlockAccountDto) {
    return this.unlockAccountCommand.execute(dto);
  }

  @Post('password-reset-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiBody({ type: RequestPasswordResetDto })
  @ApiOkResponse({
    type: AuthenticationSuccessResponseDto,
    description: 'Password reset email was queued when account exists.',
  })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.requestPasswordResetCommand.execute(dto);
  }

  @Post('password-reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password with email code' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({
    type: AuthenticationSuccessResponseDto,
    description: 'Password was reset.',
  })
  @ApiBadRequestResponse({
    type: AuthenticationErrorResponseDto,
    description: 'Password reset code is missing, invalid, or expired.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.resetPasswordCommand.execute(dto);
  }
}
