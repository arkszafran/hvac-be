import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  CustomerType,
  DeviceType,
  ServiceOrderSource,
  ServiceOrderStatus,
  ServiceOrderType,
} from '@generated/prisma/enums';

import type {
  ApiSuccessResponse,
  PaginationDto,
} from '../../../common/types/api-response.type';

export class CustomerListItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: CustomerType })
  type: CustomerType;

  @ApiProperty({ type: String, nullable: true })
  companyName: string | null;

  @ApiProperty({ type: String, nullable: true })
  fullName: string | null;

  @ApiProperty()
  phone: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  postalCode: string;

  @ApiProperty()
  city: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class CustomerDto extends CustomerListItemDto {}

export class CustomerServiceOrderDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  customerId: string;

  @ApiProperty({ enum: ServiceOrderType })
  type: ServiceOrderType;

  @ApiProperty({ enum: ServiceOrderSource })
  source: ServiceOrderSource;

  @ApiProperty({ enum: ServiceOrderStatus })
  status: ServiceOrderStatus;

  @ApiProperty({ format: 'uuid', nullable: true })
  assigneeUserId: string | null;

  @ApiProperty({ format: 'date-time' })
  orderDate: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  scheduledAt: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  nextContactAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class InspectionServiceOrderDto extends CustomerServiceOrderDto {
  @ApiProperty({
    enum: ServiceOrderType,
    example: ServiceOrderType.inspection,
  })
  declare type: typeof ServiceOrderType.inspection;
}

export class CustomerDeviceListItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  customerId: string;

  @ApiProperty({ enum: DeviceType })
  type: DeviceType;

  @ApiProperty()
  brand: string;

  @ApiProperty()
  model: string;

  @ApiProperty()
  serialNumber: string;

  @ApiProperty({ format: 'date' })
  installationDate: string;

  @ApiProperty()
  location: string;

  @ApiProperty()
  hasCustomInstallationAddress: boolean;

  @ApiProperty()
  address: string;

  @ApiProperty()
  postalCode: string;

  @ApiProperty()
  city: string;

  @ApiProperty({ type: InspectionServiceOrderDto, nullable: true })
  activeInspection: InspectionServiceOrderDto | null;
}

export class PaginationResponseDto implements PaginationDto {
  @ApiProperty({ minimum: 1 })
  page: number;

  @ApiProperty({ minimum: 1 })
  pageSize: number;

  @ApiProperty({ minimum: 0 })
  totalItems: number;

  @ApiProperty({ minimum: 0 })
  totalPages: number;
}

export class ClientFilteredCustomersDto {
  @ApiProperty({ enum: ['client'], example: 'client' })
  filteringMode: 'client';

  @ApiProperty({ type: [CustomerListItemDto] })
  items: CustomerListItemDto[];

  @ApiProperty({ minimum: 0 })
  totalItems: number;
}

export class ServerFilteredCustomersDto {
  @ApiProperty({ enum: ['server'], example: 'server' })
  filteringMode: 'server';

  @ApiProperty({ type: [CustomerListItemDto] })
  items: CustomerListItemDto[];

  @ApiProperty({ type: PaginationResponseDto })
  pagination: PaginationDto;
}

export type CustomersListDataDto =
  | ClientFilteredCustomersDto
  | ServerFilteredCustomersDto;

export class CustomersListResponseDto implements ApiSuccessResponse<CustomersListDataDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ClientFilteredCustomersDto) },
      { $ref: getSchemaPath(ServerFilteredCustomersDto) },
    ],
    discriminator: {
      propertyName: 'filteringMode',
      mapping: {
        client: getSchemaPath(ClientFilteredCustomersDto),
        server: getSchemaPath(ServerFilteredCustomersDto),
      },
    },
  })
  data: CustomersListDataDto;
}

export class CustomerDetailsDto {
  @ApiProperty({ type: CustomerDto })
  customer: CustomerDto;

  @ApiProperty({ type: [CustomerDeviceListItemDto] })
  devices: CustomerDeviceListItemDto[];

  @ApiProperty({ type: [CustomerServiceOrderDto] })
  serviceOrders: CustomerServiceOrderDto[];
}

export class CustomerDetailsResponseDto implements ApiSuccessResponse<CustomerDetailsDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: CustomerDetailsDto })
  data: CustomerDetailsDto;
}

export class CreateCustomerResponseDto implements ApiSuccessResponse<CustomerDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: CustomerDto })
  data: CustomerDto;
}

export class UpdateCustomerResponseDto extends CreateCustomerResponseDto {}

export class CustomersErrorDto {
  @ApiProperty({ example: 'CUSTOMER_NOT_FOUND' })
  code: string;

  @ApiProperty({ example: 'Customer was not found.' })
  message: string;

  @ApiProperty({ type: 'object', nullable: true, additionalProperties: true })
  details: null | Record<string, unknown>;
}

export class CustomersErrorResponseDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ type: CustomersErrorDto })
  error: CustomersErrorDto;
}
