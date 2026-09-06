import {
  Body,
  Controller,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@generated/prisma/enums';
import {
  AllowNewUser,
  AuthGuard,
  AuthRoles,
  RoleAuthGuard,
  type AuthenticatedRequest,
} from '@auth';

import { AUTH_COOKIE_NAMES } from '../../authentication/authentication.constants';
import { ChangePasswordCommand } from '../commands/impl/change-password.command';
import { ChangePinCommand } from '../commands/impl/change-pin.command';
import { CreateTenantCommand } from '../commands/impl/create-tenant.command';
import { SetupNewUserCredentialsCommand } from '../commands/impl/setup-new-user-credentials.command';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ChangePinDto } from '../dto/change-pin.dto';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { SetupNewUserCredentialsDto } from '../dto/setup-new-user-credentials.dto';
import {
  CreateTenantResponseDto,
  UsersErrorResponseDto,
  UsersSuccessResponseDto,
} from '../dto/user-response.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('tenants')
  @HttpCode(201)
  @UseGuards(AuthGuard, RoleAuthGuard)
  @AuthRoles({ userRole: UserRole.ADMIN })
  @ApiOperation({ summary: 'Create tenant and assign its admin user' })
  @ApiCookieAuth(AUTH_COOKIE_NAMES.accessToken)
  @ApiBody({ type: CreateTenantDto })
  @ApiCreatedResponse({
    type: CreateTenantResponseDto,
    description: 'Tenant was created and its admin user was assigned.',
  })
  createTenant(@Body() dto: CreateTenantDto) {
    return this.commandBus.execute(new CreateTenantCommand(dto));
  }

  @Patch('me/initial-credentials')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @AllowNewUser()
  @ApiOperation({ summary: 'Set password and PIN for a new user' })
  @ApiCookieAuth(AUTH_COOKIE_NAMES.accessToken)
  @ApiBody({ type: SetupNewUserCredentialsDto })
  @ApiOkResponse({
    type: UsersSuccessResponseDto,
    description: 'Password and PIN were set.',
  })
  @ApiBadRequestResponse({
    type: UsersErrorResponseDto,
    description: 'Account setup is not available.',
  })
  @ApiUnauthorizedResponse({
    type: UsersErrorResponseDto,
    description: 'Current password is invalid.',
  })
  setupInitialCredentials(
    @Body() dto: SetupNewUserCredentialsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commandBus.execute(
      new SetupNewUserCredentialsCommand(request.user!.id, dto),
    );
  }

  @Patch('me/password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Change current user password' })
  @ApiCookieAuth(AUTH_COOKIE_NAMES.accessToken)
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({
    type: UsersSuccessResponseDto,
    description: 'Password was changed.',
  })
  @ApiUnauthorizedResponse({
    type: UsersErrorResponseDto,
    description: 'Current password is invalid.',
  })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commandBus.execute(
      new ChangePasswordCommand(request.user!.id, dto),
    );
  }

  @Patch('me/pin')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Change current user PIN' })
  @ApiCookieAuth(AUTH_COOKIE_NAMES.accessToken)
  @ApiBody({ type: ChangePinDto })
  @ApiOkResponse({
    type: UsersSuccessResponseDto,
    description: 'PIN was changed.',
  })
  @ApiUnauthorizedResponse({
    type: UsersErrorResponseDto,
    description: 'Current password is invalid.',
  })
  changePin(@Body() dto: ChangePinDto, @Req() request: AuthenticatedRequest) {
    return this.commandBus.execute(new ChangePinCommand(request.user!.id, dto));
  }
}
