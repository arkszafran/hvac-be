import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
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
import { ServiceOrdersErrorResponseDto } from '../dto/service-order-response.dto';
import { ServiceOrderDetailsQueryDto } from '../dto/service-order-details-query.dto';
import { ServiceOrderDetailsResponseDto } from '../dto/service-order-details-response.dto';
import { ServiceOrdersListResponseDto } from '../dto/service-orders-list-response.dto';
import { ServiceOrdersListQueryDto } from '../dto/service-orders-list-query.dto';
import { GetServiceOrderDetailsQuery } from '../queries/impl/get-service-order-details.query';
import { ListServiceOrdersQuery } from '../queries/impl/list-service-orders.query';

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
  @ApiOperation({ summary: 'List service orders' })
  @ApiOkResponse({ type: ServiceOrdersListResponseDto })
  @ApiBadRequestResponse({ type: ServiceOrdersErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ServiceOrdersErrorResponseDto })
  @ApiForbiddenResponse({ type: ServiceOrdersErrorResponseDto })
  list(
    @TenantId() tenantId: string,
    @Query() dto: ServiceOrdersListQueryDto,
  ): Promise<ServiceOrdersListResponseDto> {
    return this.queryBus.execute(new ListServiceOrdersQuery(tenantId, dto));
  }

  @Get(':serviceOrderId')
  @ApiOperation({ summary: 'Get service order details' })
  @ApiParam({ name: 'serviceOrderId', format: 'uuid' })
  @ApiOkResponse({ type: ServiceOrderDetailsResponseDto })
  @ApiBadRequestResponse({ type: ServiceOrdersErrorResponseDto })
  @ApiNotFoundResponse({ type: ServiceOrdersErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ServiceOrdersErrorResponseDto })
  @ApiForbiddenResponse({ type: ServiceOrdersErrorResponseDto })
  details(
    @TenantId() tenantId: string,
    @Param('serviceOrderId', new ParseUUIDPipe({ version: '4' }))
    serviceOrderId: string,
    @Query() dto: ServiceOrderDetailsQueryDto,
  ): Promise<ServiceOrderDetailsResponseDto> {
    return this.queryBus.execute(
      new GetServiceOrderDetailsQuery(
        tenantId,
        serviceOrderId,
        dto.ommitAttachments ?? false,
      ),
    );
  }
}
