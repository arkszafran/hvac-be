import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CustomerType,
  DeviceType,
  ServiceOrderSource,
  ServiceOrderStatus,
  ServiceOrderType,
  VisitType,
} from '@generated/prisma/enums';

import type { ApiSuccessResponse } from '../../../common/types/api-response.type';

export class CustomerSummaryDto {
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
}

export class PhotoAttachmentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional()
  description?: string;
}

export class DeviceVisitDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  deviceId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  serviceOrderId?: string;

  @ApiProperty({ format: 'uuid' })
  customerId: string;

  @ApiProperty()
  userName: string;

  @ApiProperty({ format: 'date' })
  date: string;

  @ApiProperty({ enum: VisitType })
  type: VisitType;

  @ApiProperty()
  note: string;

  @ApiProperty({ type: [PhotoAttachmentDto] })
  photos: PhotoAttachmentDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class DeviceDto {
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

  @ApiProperty({ type: Number, nullable: true })
  powerKw: number | null;

  @ApiProperty()
  serialNumber: string;

  @ApiProperty({ format: 'date' })
  installationDate: string;

  @ApiProperty()
  warrantyMonths: number;

  @ApiProperty({ format: 'date' })
  warrantyUntil: string;

  @ApiProperty()
  note: string;

  @ApiProperty()
  refrigerant: string;

  @ApiProperty()
  refrigerantAmount: string;

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

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

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
  customerConfirmationStatus: 'pending' | 'confirmed' | 'not_confirmed';

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

export class DeviceDetailsDto {
  @ApiProperty({ type: CustomerSummaryDto })
  customer: CustomerSummaryDto;

  @ApiProperty({ type: DeviceDto })
  device: DeviceDto;

  @ApiProperty({ type: InspectionServiceOrderDto, nullable: true })
  activeInspection: InspectionServiceOrderDto | null;

  @ApiProperty({ type: [DeviceVisitDto] })
  visits: DeviceVisitDto[];
}

export class DeviceDetailsResponseDto implements ApiSuccessResponse<DeviceDetailsDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: DeviceDetailsDto })
  data: DeviceDetailsDto;
}

export class DeviceMutationResultDto {
  @ApiProperty({ type: DeviceDto })
  device: DeviceDto;
}

export class CreateDeviceResponseDto implements ApiSuccessResponse<DeviceMutationResultDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: DeviceMutationResultDto })
  data: DeviceMutationResultDto;
}

export class UpdateDeviceResponseDto extends CreateDeviceResponseDto {}

export class DevicesErrorDto {
  @ApiProperty({ example: 'DEVICE_NOT_FOUND' })
  code: string;

  @ApiProperty({ example: 'Device was not found.' })
  message: string;

  @ApiProperty({ type: 'object', nullable: true, additionalProperties: true })
  details: null | Record<string, unknown>;
}

export class DevicesErrorResponseDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ type: DevicesErrorDto })
  error: DevicesErrorDto;
}
