import {
  Body,
  Controller,
  Get,
  HttpCode,
  ParseUUIDPipe,
  Post,
  Query,
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
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@generated/prisma/enums';
import {
  AuthGuard,
  AuthRoles,
  RoleAuthGuard,
  TenantGuard,
  TenantId,
  UserId,
} from '@auth';

import { AUTH_COOKIE_NAMES } from '../../authentication/authentication.constants';
import { CreateVisitCommand } from '../commands/impl/create-visit.command';
import { CreateVisitDto } from '../dto/create-visit.dto';
import {
  CreateVisitResponseDto,
  VisitsErrorResponseDto,
  VisitsListResponseDto,
} from '../dto/visit-response.dto';
import { VisitsListQueryDto } from '../dto/visits-list-query.dto';
import { ListVisitsQuery } from '../queries/impl/list-visits.query';
import { IdempotencyKey } from './idempotency-key.decorator';

@ApiTags('visits')
@ApiCookieAuth(AUTH_COOKIE_NAMES.accessToken)
@ApiProduces('application/json')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant selected by the authenticated user.',
})
@UseGuards(AuthGuard, TenantGuard, RoleAuthGuard)
@AuthRoles({ userRole: UserRole.TENANT_USER })
@Controller('visits')
export class VisitsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List visits' })
  @ApiOkResponse({ type: VisitsListResponseDto })
  @ApiBadRequestResponse({ type: VisitsErrorResponseDto })
  @ApiUnauthorizedResponse({ type: VisitsErrorResponseDto })
  @ApiForbiddenResponse({ type: VisitsErrorResponseDto })
  list(
    @TenantId() tenantId: string,
    @Query() dto: VisitsListQueryDto,
  ): Promise<VisitsListResponseDto> {
    return this.queryBus.execute(new ListVisitsQuery(tenantId, dto));
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a visit and all related records atomically',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiConsumes('application/json')
  @ApiBody({ type: CreateVisitDto })
  @ApiCreatedResponse({ type: CreateVisitResponseDto })
  @ApiBadRequestResponse({ type: VisitsErrorResponseDto })
  @ApiConflictResponse({ type: VisitsErrorResponseDto })
  @ApiNotFoundResponse({ type: VisitsErrorResponseDto })
  @ApiUnauthorizedResponse({ type: VisitsErrorResponseDto })
  @ApiForbiddenResponse({ type: VisitsErrorResponseDto })
  create(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @IdempotencyKey(new ParseUUIDPipe({ version: '4' }))
    idempotencyKey: string,
    @Body() dto: CreateVisitDto,
  ): Promise<CreateVisitResponseDto> {
    return this.commandBus.execute(
      new CreateVisitCommand(tenantId, userId, idempotencyKey, dto),
    );
  }
}
