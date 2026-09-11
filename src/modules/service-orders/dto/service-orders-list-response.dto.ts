import { ApiProperty } from '@nestjs/swagger';
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

export class ServiceOrderDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  customerId: string | null;

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

export class ServiceOrderCustomerDto {
  @ApiProperty({ format: 'uuid', nullable: true })
  customerId: string | null;

  @ApiProperty({ enum: CustomerType })
  type: CustomerType;

  @ApiProperty()
  companyName: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  postalCode: string;

  @ApiProperty()
  city: string;
}

export class ServiceOrderAssigneeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
}

export class ServiceOrderDeviceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  deviceId: string | null;

  @ApiProperty({ enum: DeviceType })
  type: DeviceType;

  @ApiProperty()
  brand: string;

  @ApiProperty()
  model: string;

  @ApiProperty()
  serialNumber: string;

  @ApiProperty()
  refrigerant: string;

  @ApiProperty()
  refrigerantAmount: string;

  @ApiProperty({ nullable: true })
  displayedError: string | null;

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
}

export class ServiceOrderListItemDto {
  @ApiProperty({ type: ServiceOrderDto })
  order: ServiceOrderDto;

  @ApiProperty({ type: ServiceOrderCustomerDto })
  customer: ServiceOrderCustomerDto;

  @ApiProperty({ type: ServiceOrderAssigneeDto, nullable: true })
  assignee: ServiceOrderAssigneeDto | null;

  @ApiProperty({ type: [ServiceOrderDeviceDto] })
  devices: ServiceOrderDeviceDto[];
}

export class ServiceOrdersPaginationDto implements PaginationDto {
  @ApiProperty({ minimum: 1 })
  page: number;

  @ApiProperty({ minimum: 1 })
  pageSize: number;

  @ApiProperty({ minimum: 0 })
  totalItems: number;

  @ApiProperty({ minimum: 0 })
  totalPages: number;
}

export class ServiceOrdersListDataDto {
  @ApiProperty({ type: [ServiceOrderListItemDto] })
  items: ServiceOrderListItemDto[];

  @ApiProperty({ type: ServiceOrdersPaginationDto })
  pagination: ServiceOrdersPaginationDto;
}

export class ServiceOrdersListResponseDto implements ApiSuccessResponse<ServiceOrdersListDataDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: ServiceOrdersListDataDto })
  data: ServiceOrdersListDataDto;
}
