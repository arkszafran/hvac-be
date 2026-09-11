import { ApiProperty } from '@nestjs/swagger';
import {
  AttachmentScanStatus,
  CustomerType,
  DeviceType,
  ServiceOrderSource,
  ServiceOrderStatus,
  ServiceOrderType,
  VisitType,
} from '@generated/prisma/enums';

import type {
  ApiSuccessResponse,
  PaginationDto,
} from '../../../common/types/api-response.type';
import { AttachmentUploadFormDto } from '../../attachments/dto/attachment-response.dto';

export class VisitCustomerSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: CustomerType })
  type: CustomerType;

  @ApiProperty({ nullable: true })
  companyName: string | null;

  @ApiProperty({ nullable: true })
  fullName: string | null;

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

export class VisitUserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

export class VisitDeviceSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: DeviceType })
  type: DeviceType;

  @ApiProperty()
  brand: string;

  @ApiProperty()
  model: string;

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

export class VisitDeviceDto {
  @ApiProperty({ type: VisitDeviceSummaryDto })
  device: VisitDeviceSummaryDto;

  @ApiProperty()
  note: string;
}

export class VisitListItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  serviceOrderId: string | null;

  @ApiProperty({ enum: VisitType })
  type: VisitType;

  @ApiProperty({ format: 'date' })
  performedOn: string;

  @ApiProperty({ type: VisitUserSummaryDto })
  handledBy: VisitUserSummaryDto;

  @ApiProperty({ type: VisitCustomerSummaryDto })
  customer: VisitCustomerSummaryDto;

  @ApiProperty({ type: [VisitDeviceDto] })
  devices: VisitDeviceDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class VisitsPaginationDto implements PaginationDto {
  @ApiProperty({ minimum: 1 })
  page: number;

  @ApiProperty({ minimum: 1 })
  pageSize: number;

  @ApiProperty({ minimum: 0 })
  totalItems: number;

  @ApiProperty({ minimum: 0 })
  totalPages: number;
}

export class VisitsListDataDto {
  @ApiProperty({ type: [VisitListItemDto] })
  items: VisitListItemDto[];

  @ApiProperty({ type: VisitsPaginationDto })
  pagination: VisitsPaginationDto;
}

export class VisitsListResponseDto implements ApiSuccessResponse<VisitsListDataDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: VisitsListDataDto })
  data: VisitsListDataDto;
}

export class PendingAttachmentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  contentType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: [AttachmentScanStatus.pending_upload] })
  status: typeof AttachmentScanStatus.pending_upload;

  @ApiProperty({ type: String, nullable: true, example: null })
  url: null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class VisitAttachmentUploadDto {
  @ApiProperty()
  clientFileId: string;

  @ApiProperty({ type: PendingAttachmentDto })
  attachment: PendingAttachmentDto;

  @ApiProperty({ type: AttachmentUploadFormDto })
  upload: AttachmentUploadFormDto;
}

export class VisitServiceOrderDto {
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

export class CompletedServiceOrderDto extends VisitServiceOrderDto {
  @ApiProperty({ enum: [ServiceOrderStatus.completed] })
  declare status: typeof ServiceOrderStatus.completed;
}

export class NewInspectionServiceOrderDto extends VisitServiceOrderDto {
  @ApiProperty({ enum: [ServiceOrderType.inspection] })
  declare type: typeof ServiceOrderType.inspection;

  @ApiProperty({ enum: [ServiceOrderSource.system] })
  declare source: typeof ServiceOrderSource.system;

  @ApiProperty({ enum: [ServiceOrderStatus.new] })
  declare status: typeof ServiceOrderStatus.new;
}

export class VisitDto extends VisitListItemDto {
  @ApiProperty({ type: [PendingAttachmentDto] })
  attachments: PendingAttachmentDto[];
}

export class CreateVisitResultDto {
  @ApiProperty({ type: VisitDto })
  visit: VisitDto;

  @ApiProperty({ type: CompletedServiceOrderDto, nullable: true })
  completedServiceOrder: CompletedServiceOrderDto | null;

  @ApiProperty({ type: NewInspectionServiceOrderDto, nullable: true })
  nextInspectionServiceOrder: NewInspectionServiceOrderDto | null;

  @ApiProperty({ type: [VisitAttachmentUploadDto] })
  attachmentUploads: VisitAttachmentUploadDto[];
}

export class CreateVisitResponseDto implements ApiSuccessResponse<CreateVisitResultDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: CreateVisitResultDto })
  data: CreateVisitResultDto;
}

export class VisitsErrorDto {
  @ApiProperty({ example: 'VISIT_CUSTOMER_NOT_FOUND' })
  code: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: 'object', nullable: true, additionalProperties: true })
  details: null | Record<string, unknown>;
}

export class VisitsErrorResponseDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ type: VisitsErrorDto })
  error: VisitsErrorDto;
}
