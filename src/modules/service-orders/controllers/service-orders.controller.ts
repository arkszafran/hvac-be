import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
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
import {
  ActiveInspectionServiceOrdersResponseDto,
  ServiceOrdersErrorResponseDto,
} from '../dto/service-order-response.dto';
import { ServiceOrdersQueryDto } from '../dto/service-orders-query.dto';
import { ListInspectionServiceOrdersQuery } from '../queries/impl/list-inspection-service-orders.query';

@ApiTags('service-orders')
@ApiCookieAuth(AUTH_COOKIE_NAMES.accessToken)
@ApiProduces('application/json')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant selected by the authenticated user.',
})
@UseGuards(AuthGuard, TenantGuard, RoleAuthGuard)
@AuthRoles({ userRole: UserRole.TENANT_USER })
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'List customer inspection service orders' })
  @ApiOkResponse({ type: ActiveInspectionServiceOrdersResponseDto })
  @ApiBadRequestResponse({ type: ServiceOrdersErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ServiceOrdersErrorResponseDto })
  @ApiForbiddenResponse({ type: ServiceOrdersErrorResponseDto })
  list(
    @TenantId() tenantId: string,
    @Query() dto: ServiceOrdersQueryDto,
  ): Promise<ActiveInspectionServiceOrdersResponseDto> {
    return this.queryBus.execute(
      new ListInspectionServiceOrdersQuery(tenantId, dto),
    );
  }
}
