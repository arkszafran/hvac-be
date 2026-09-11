import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  AttachmentScanStatus,
  ServiceOrderBuildingType,
  ServiceOrderOutdoorUnitPlace,
  ServiceOrderType,
} from '@generated/prisma/enums';

import type { ApiSuccessResponse } from '../../../common/types/api-response.type';
import {
  ServiceOrderAssigneeDto,
  ServiceOrderCustomerDto,
  ServiceOrderDeviceDto,
  ServiceOrderDto,
} from './service-orders-list-response.dto';

export type CustomerConfirmationStatus =
  | 'pending'
  | 'confirmed'
  | 'not_confirmed';

export class ServiceOrderAttachmentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  contentType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty({ enum: AttachmentScanStatus })
  status: AttachmentScanStatus;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty()
  url: string;

  @ApiProperty({ format: 'date-time' })
  urlExpiresAt: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class ServiceOrderRoomBaseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  area: number;

  @ApiProperty()
  height: number;

  @ApiProperty({ enum: ServiceOrderOutdoorUnitPlace })
  outdoorUnitPlace: ServiceOrderOutdoorUnitPlace;

  @ApiProperty()
  estimatedDistanceToOutdoorUnit: number;

  @ApiProperty()
  floor: number;
}

export class ServiceOrderDeviceDetailsBaseDto extends ServiceOrderDeviceDto {}

export class ServiceOrderNoteAuthorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

export class ServiceOrderNoteBaseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: ServiceOrderNoteAuthorDto })
  author: ServiceOrderNoteAuthorDto;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  updatedAt: string | null;
}

export class ServiceOrderRoomWithAttachmentsDto extends ServiceOrderRoomBaseDto {
  @ApiProperty({ type: [ServiceOrderAttachmentDto] })
  photos: ServiceOrderAttachmentDto[];
}

export class ServiceOrderDeviceWithAttachmentsDto extends ServiceOrderDeviceDetailsBaseDto {
  @ApiProperty({ type: [ServiceOrderAttachmentDto] })
  nameplatePhotos: ServiceOrderAttachmentDto[];
}

export class ServiceOrderNoteWithAttachmentsDto extends ServiceOrderNoteBaseDto {
  @ApiProperty({ type: [ServiceOrderAttachmentDto] })
  photos: ServiceOrderAttachmentDto[];
}

export class InstallationServiceOrderDataWithAttachmentsDto {
  @ApiProperty({ enum: [ServiceOrderType.installation] })
  type: typeof ServiceOrderType.installation;

  @ApiProperty({ enum: ServiceOrderBuildingType })
  buildingType: ServiceOrderBuildingType;

  @ApiProperty({ type: [ServiceOrderRoomWithAttachmentsDto] })
  rooms: ServiceOrderRoomWithAttachmentsDto[];

  @ApiProperty({ type: [ServiceOrderAttachmentDto] })
  photos: ServiceOrderAttachmentDto[];
}

export class RepairServiceOrderDataWithAttachmentsDto {
  @ApiProperty({ enum: [ServiceOrderType.repair] })
  type: typeof ServiceOrderType.repair;

  @ApiProperty({ type: [ServiceOrderDeviceWithAttachmentsDto] })
  devices: ServiceOrderDeviceWithAttachmentsDto[];
}

export class InspectionServiceOrderDataWithAttachmentsDto {
  @ApiProperty({ enum: [ServiceOrderType.inspection] })
  type: typeof ServiceOrderType.inspection;

  @ApiProperty({ type: [ServiceOrderDeviceWithAttachmentsDto] })
  devices: ServiceOrderDeviceWithAttachmentsDto[];

  @ApiProperty({ enum: ['pending', 'confirmed', 'not_confirmed'] })
  customerConfirmationStatus: CustomerConfirmationStatus;

  @ApiProperty({ format: 'date-time', nullable: true })
  confirmationReminderSentAt: string | null;
}

export type ServiceOrderDataWithAttachmentsDto =
  | InstallationServiceOrderDataWithAttachmentsDto
  | RepairServiceOrderDataWithAttachmentsDto
  | InspectionServiceOrderDataWithAttachmentsDto;

export class ServiceOrderDetailsWithAttachmentsDto {
  @ApiProperty({ enum: [false] })
  attachmentsOmitted: false;

  @ApiProperty({ type: ServiceOrderDto })
  order: ServiceOrderDto;

  @ApiProperty({ type: ServiceOrderCustomerDto })
  customer: ServiceOrderCustomerDto;

  @ApiProperty({ type: ServiceOrderAssigneeDto, nullable: true })
  assignee: ServiceOrderAssigneeDto | null;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(InstallationServiceOrderDataWithAttachmentsDto) },
      { $ref: getSchemaPath(RepairServiceOrderDataWithAttachmentsDto) },
      { $ref: getSchemaPath(InspectionServiceOrderDataWithAttachmentsDto) },
    ],
    discriminator: { propertyName: 'type' },
  })
  serviceData: ServiceOrderDataWithAttachmentsDto;

  @ApiProperty({ type: [ServiceOrderNoteWithAttachmentsDto] })
  notes: ServiceOrderNoteWithAttachmentsDto[];
}

export class InstallationServiceOrderDataWithoutAttachmentsDto {
  @ApiProperty({ enum: [ServiceOrderType.installation] })
  type: typeof ServiceOrderType.installation;

  @ApiProperty({ enum: ServiceOrderBuildingType })
  buildingType: ServiceOrderBuildingType;

  @ApiProperty({ type: [ServiceOrderRoomBaseDto] })
  rooms: ServiceOrderRoomBaseDto[];
}

export class RepairServiceOrderDataWithoutAttachmentsDto {
  @ApiProperty({ enum: [ServiceOrderType.repair] })
  type: typeof ServiceOrderType.repair;

  @ApiProperty({ type: [ServiceOrderDeviceDetailsBaseDto] })
  devices: ServiceOrderDeviceDetailsBaseDto[];
}

export class InspectionServiceOrderDataWithoutAttachmentsDto {
  @ApiProperty({ enum: [ServiceOrderType.inspection] })
  type: typeof ServiceOrderType.inspection;

  @ApiProperty({ type: [ServiceOrderDeviceDetailsBaseDto] })
  devices: ServiceOrderDeviceDetailsBaseDto[];

  @ApiProperty({ enum: ['pending', 'confirmed', 'not_confirmed'] })
  customerConfirmationStatus: CustomerConfirmationStatus;

  @ApiProperty({ format: 'date-time', nullable: true })
  confirmationReminderSentAt: string | null;
}

export type ServiceOrderDataWithoutAttachmentsDto =
  | InstallationServiceOrderDataWithoutAttachmentsDto
  | RepairServiceOrderDataWithoutAttachmentsDto
  | InspectionServiceOrderDataWithoutAttachmentsDto;

export class ServiceOrderDetailsWithoutAttachmentsDto {
  @ApiProperty({ enum: [true] })
  attachmentsOmitted: true;

  @ApiProperty({ type: ServiceOrderDto })
  order: ServiceOrderDto;

  @ApiProperty({ type: ServiceOrderCustomerDto })
  customer: ServiceOrderCustomerDto;

  @ApiProperty({ type: ServiceOrderAssigneeDto, nullable: true })
  assignee: ServiceOrderAssigneeDto | null;

  @ApiProperty({
    oneOf: [
      {
        $ref: getSchemaPath(InstallationServiceOrderDataWithoutAttachmentsDto),
      },
      { $ref: getSchemaPath(RepairServiceOrderDataWithoutAttachmentsDto) },
      { $ref: getSchemaPath(InspectionServiceOrderDataWithoutAttachmentsDto) },
    ],
    discriminator: { propertyName: 'type' },
  })
  serviceData: ServiceOrderDataWithoutAttachmentsDto;

  @ApiProperty({ type: [ServiceOrderNoteBaseDto] })
  notes: ServiceOrderNoteBaseDto[];
}

export type ServiceOrderDetailsDto =
  | ServiceOrderDetailsWithAttachmentsDto
  | ServiceOrderDetailsWithoutAttachmentsDto;

@ApiExtraModels(
  InstallationServiceOrderDataWithAttachmentsDto,
  RepairServiceOrderDataWithAttachmentsDto,
  InspectionServiceOrderDataWithAttachmentsDto,
  InstallationServiceOrderDataWithoutAttachmentsDto,
  RepairServiceOrderDataWithoutAttachmentsDto,
  InspectionServiceOrderDataWithoutAttachmentsDto,
  ServiceOrderDetailsWithAttachmentsDto,
  ServiceOrderDetailsWithoutAttachmentsDto,
)
export class ServiceOrderDetailsResponseDto implements ApiSuccessResponse<ServiceOrderDetailsDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ServiceOrderDetailsWithAttachmentsDto) },
      { $ref: getSchemaPath(ServiceOrderDetailsWithoutAttachmentsDto) },
    ],
    discriminator: { propertyName: 'attachmentsOmitted' },
  })
  data: ServiceOrderDetailsDto;
}
