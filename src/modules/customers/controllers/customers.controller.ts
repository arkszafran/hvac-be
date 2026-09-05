import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
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

import { AUTH_COOKIE_NAMES } from '../../authentication/authentication.constants';
import { CreateCustomerCommand } from '../commands/impl/create-customer.command';
import { UpdateCustomerCommand } from '../commands/impl/update-customer.command';
import {
  ClientFilteredCustomersDto,
  CreateCustomerResponseDto,
  CustomerDetailsResponseDto,
  CustomersErrorResponseDto,
  CustomersListResponseDto,
  PaginationResponseDto,
  ServerFilteredCustomersDto,
  UpdateCustomerResponseDto,
} from '../dto/customer-response.dto';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import {
  CustomersQueryDto,
  CustomersSortBy,
  SortDirection,
} from '../dto/customers-query.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { GetCustomerDetailsQuery } from '../queries/impl/get-customer-details.query';
import { ListCustomersQuery } from '../queries/impl/list-customers.query';
import { UserRole } from '@generated/prisma/enums';

@ApiTags('customers')
@ApiCookieAuth(AUTH_COOKIE_NAMES.accessToken)
@ApiProduces('application/json')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant selected by the authenticated user.',
})
@ApiExtraModels(
  ClientFilteredCustomersDto,
  ServerFilteredCustomersDto,
  PaginationResponseDto,
)
@UseGuards(AuthGuard, TenantGuard, RoleAuthGuard)
@AuthRoles({ userRole: UserRole.TENANT_USER })
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List customers' })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: 'sortBy', required: false, enum: CustomersSortBy })
  @ApiQuery({
    name: 'sortDirection',
    required: false,
    enum: SortDirection,
  })
  @ApiOkResponse({
    type: CustomersListResponseDto,
    description: 'Customers returned in client- or server-filtered mode.',
  })
  @ApiBadRequestResponse({
    type: CustomersErrorResponseDto,
    description: 'Query parameters are invalid.',
  })
  @ApiUnauthorizedResponse({
    type: CustomersErrorResponseDto,
    description: 'Authentication is missing or invalid.',
  })
  @ApiForbiddenResponse({
    type: CustomersErrorResponseDto,
    description: 'The user does not have access to the selected tenant.',
  })
  list(
    @TenantId() tenantId: string,
    @Query() dto: CustomersQueryDto,
  ): Promise<CustomersListResponseDto> {
    return this.queryBus.execute(new ListCustomersQuery(tenantId, dto));
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create customer' })
  @ApiConsumes('application/json')
  @ApiBody({ type: CreateCustomerDto })
  @ApiCreatedResponse({
    type: CreateCustomerResponseDto,
    description: 'Customer was created.',
  })
  @ApiBadRequestResponse({
    type: CustomersErrorResponseDto,
    description: 'Request body is invalid.',
  })
  @ApiConflictResponse({
    type: CustomersErrorResponseDto,
    description: 'A customer with this email already exists in the tenant.',
  })
  @ApiUnauthorizedResponse({
    type: CustomersErrorResponseDto,
    description: 'Authentication is missing or invalid.',
  })
  @ApiForbiddenResponse({
    type: CustomersErrorResponseDto,
    description: 'The user does not have access to the selected tenant.',
  })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateCustomerDto,
  ): Promise<CreateCustomerResponseDto> {
    return this.commandBus.execute(new CreateCustomerCommand(tenantId, dto));
  }

  @Get(':customerId')
  @ApiOperation({ summary: 'Get customer with devices and service orders' })
  @ApiParam({ name: 'customerId', type: String, format: 'uuid' })
  @ApiOkResponse({
    type: CustomerDetailsResponseDto,
    description: 'Aggregated customer details were returned.',
  })
  @ApiNotFoundResponse({
    type: CustomersErrorResponseDto,
    description: 'Customer does not exist in the selected tenant.',
  })
  @ApiUnauthorizedResponse({
    type: CustomersErrorResponseDto,
    description: 'Authentication is missing or invalid.',
  })
  @ApiForbiddenResponse({
    type: CustomersErrorResponseDto,
    description: 'The user does not have access to the selected tenant.',
  })
  details(
    @TenantId() tenantId: string,
    @Param('customerId', new ParseUUIDPipe({ version: '4' }))
    customerId: string,
  ): Promise<CustomerDetailsResponseDto> {
    return this.queryBus.execute(
      new GetCustomerDetailsQuery(tenantId, customerId),
    );
  }

  @Patch(':customerId')
  @ApiOperation({ summary: 'Update customer' })
  @ApiConsumes('application/json')
  @ApiParam({ name: 'customerId', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiOkResponse({
    type: UpdateCustomerResponseDto,
    description: 'Customer was updated.',
  })
  @ApiBadRequestResponse({
    type: CustomersErrorResponseDto,
    description: 'Path parameter or request body is invalid.',
  })
  @ApiConflictResponse({
    type: CustomersErrorResponseDto,
    description: 'A customer with this email already exists in the tenant.',
  })
  @ApiNotFoundResponse({
    type: CustomersErrorResponseDto,
    description: 'Customer does not exist in the selected tenant.',
  })
  @ApiUnauthorizedResponse({
    type: CustomersErrorResponseDto,
    description: 'Authentication is missing or invalid.',
  })
  @ApiForbiddenResponse({
    type: CustomersErrorResponseDto,
    description: 'The user does not have access to the selected tenant.',
  })
  update(
    @TenantId() tenantId: string,
    @Param('customerId', new ParseUUIDPipe({ version: '4' }))
    customerId: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<UpdateCustomerResponseDto> {
    return this.commandBus.execute(
      new UpdateCustomerCommand(tenantId, customerId, dto),
    );
  }
}
