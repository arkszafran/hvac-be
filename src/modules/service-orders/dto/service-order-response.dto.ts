import { ApiProperty } from '@nestjs/swagger';
import {
  ServiceOrderSource,
  ServiceOrderStatus,
  ServiceOrderType,
} from '@generated/prisma/enums';

import type { ApiSuccessResponse } from '../../../common/types/api-response.type';

export type CustomerConfirmationStatus =
  | 'pending'
  | 'confirmed'
  | 'not_confirmed';

export class RelatedInspectionDeviceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  brand: string;

  @ApiProperty()
  model: string;

  @ApiProperty()
  hasCustomInstallationAddress: boolean;

  @ApiProperty()
  address: string;

  @ApiProperty()
  postalCode: string;

  @ApiProperty()
  city: string;
}

export class InspectionServiceOrderDataDto {
  @ApiProperty({ enum: [ServiceOrderType.inspection] })
  type: typeof ServiceOrderType.inspection;

  @ApiProperty({ type: [String], format: 'uuid' })
  deviceIds: string[];

  @ApiProperty({ type: [RelatedInspectionDeviceDto] })
  devices: RelatedInspectionDeviceDto[];

  @ApiProperty({ enum: ['pending', 'confirmed', 'not_confirmed'] })
  customerConfirmationStatus: CustomerConfirmationStatus;

  @ApiProperty({ format: 'date-time', nullable: true })
  confirmationReminderSentAt: string | null;
}

export class InspectionServiceOrderDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  customerId: string;

  @ApiProperty({ enum: [ServiceOrderType.inspection] })
  type: typeof ServiceOrderType.inspection;

  @ApiProperty({ enum: ServiceOrderSource })
  source: ServiceOrderSource;

  @ApiProperty({ enum: ServiceOrderStatus })
  status: ServiceOrderStatus;

  @ApiProperty({ format: 'date-time' })
  orderDate: string;

  @ApiProperty({ format: 'date-time' })
  scheduledAt: string;

  @ApiProperty({ type: InspectionServiceOrderDataDto })
  serviceData: InspectionServiceOrderDataDto;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class ActiveInspectionServiceOrdersResponseDto implements ApiSuccessResponse<
  InspectionServiceOrderDto[]
> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: [InspectionServiceOrderDto] })
  data: InspectionServiceOrderDto[];
}

export class ServiceOrdersErrorDto {
  @ApiProperty({ example: 'SERVICE_ORDER_NOT_FOUND' })
  code: string;

  @ApiProperty({ example: 'Service order was not found.' })
  message: string;

  @ApiProperty({ type: 'object', nullable: true, additionalProperties: true })
  details: null | Record<string, unknown>;
}

export class ServiceOrdersErrorResponseDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ type: ServiceOrdersErrorDto })
  error: ServiceOrdersErrorDto;
}
