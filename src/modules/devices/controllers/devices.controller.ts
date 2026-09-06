import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AuthGuard,
  AuthRoles,
  RoleAuthGuard,
  TenantGuard,
  TenantId,
} from '@auth';
import { UserRole } from '@generated/prisma/enums';

import { AUTH_COOKIE_NAMES } from '../../authentication/authentication.constants';
import { CreateDeviceCommand } from '../commands/impl/create-device.command';
import { UpdateDeviceCommand } from '../commands/impl/update-device.command';
import { CreateDeviceDto } from '../dto/create-device.dto';
import {
  CreateDeviceResponseDto,
  DeviceDetailsResponseDto,
  DevicesErrorResponseDto,
  UpdateDeviceResponseDto,
} from '../dto/device-response.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { GetDeviceDetailsQuery } from '../queries/impl/get-device-details.query';

@ApiTags('devices')
@ApiCookieAuth(AUTH_COOKIE_NAMES.accessToken)
@ApiProduces('application/json')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant selected by the authenticated user.',
})
@UseGuards(AuthGuard, TenantGuard, RoleAuthGuard)
@AuthRoles({ userRole: UserRole.TENANT_USER })
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get(':deviceId')
  @ApiOperation({ summary: 'Get device details with inspection and visits' })
  @ApiParam({ name: 'deviceId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: DeviceDetailsResponseDto })
  @ApiNotFoundResponse({ type: DevicesErrorResponseDto })
  @ApiUnauthorizedResponse({ type: DevicesErrorResponseDto })
  @ApiForbiddenResponse({ type: DevicesErrorResponseDto })
  details(
    @TenantId() tenantId: string,
    @Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
  ): Promise<DeviceDetailsResponseDto> {
    return this.queryBus.execute(new GetDeviceDetailsQuery(tenantId, deviceId));
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create device' })
  @ApiConsumes('application/json')
  @ApiBody({ type: CreateDeviceDto })
  @ApiCreatedResponse({ type: CreateDeviceResponseDto })
  @ApiBadRequestResponse({ type: DevicesErrorResponseDto })
  @ApiConflictResponse({ type: DevicesErrorResponseDto })
  @ApiNotFoundResponse({ type: DevicesErrorResponseDto })
  @ApiUnauthorizedResponse({ type: DevicesErrorResponseDto })
  @ApiForbiddenResponse({ type: DevicesErrorResponseDto })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateDeviceDto,
  ): Promise<CreateDeviceResponseDto> {
    return this.commandBus.execute(new CreateDeviceCommand(tenantId, dto));
  }

  @Patch(':deviceId')
  @ApiOperation({ summary: 'Update device' })
  @ApiConsumes('application/json')
  @ApiParam({ name: 'deviceId', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateDeviceDto })
  @ApiOkResponse({ type: UpdateDeviceResponseDto })
  @ApiBadRequestResponse({ type: DevicesErrorResponseDto })
  @ApiConflictResponse({ type: DevicesErrorResponseDto })
  @ApiNotFoundResponse({ type: DevicesErrorResponseDto })
  @ApiUnauthorizedResponse({ type: DevicesErrorResponseDto })
  @ApiForbiddenResponse({ type: DevicesErrorResponseDto })
  update(
    @TenantId() tenantId: string,
    @Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
    @Body() dto: UpdateDeviceDto,
  ): Promise<UpdateDeviceResponseDto> {
    return this.commandBus.execute(
      new UpdateDeviceCommand(tenantId, deviceId, dto),
    );
  }
}
