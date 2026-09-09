import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentScanStatus } from '@generated/prisma/enums';

import type { ApiSuccessResponse } from '../../../common/types/api-response.type';

export class AttachmentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'jednostka-zewnetrzna.jpg' })
  fileName: string;

  @ApiProperty({ example: 'image/jpeg' })
  contentType: string;

  @ApiProperty({ example: 3145728, minimum: 1 })
  sizeBytes: number;

  @ApiProperty({ enum: AttachmentScanStatus })
  status: AttachmentScanStatus;

  @ApiProperty({
    description:
      'True only when status is clean. Request a short-lived download URL before reading the file.',
  })
  canDownload: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'Widok urządzenia' })
  description: string | null;

  @ApiProperty({ format: 'date-time' })
  uploadExpiresAt: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  uploadedAt: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  scanCompletedAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class AttachmentUploadFormDto {
  @ApiProperty({
    description:
      'Cloud Storage form action. Send multipart/form-data directly to this URL.',
    example: 'https://storage.googleapis.com/unscanned-hvac-attachments-dev/',
  })
  url: string;

  @ApiProperty({
    description:
      'Append every key/value pair to FormData before appending the file itself as the final field.',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  fields: Record<string, string>;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}

export class PreparedAttachmentDto {
  @ApiProperty({ type: AttachmentDto })
  attachment: AttachmentDto;

  @ApiProperty({ type: AttachmentUploadFormDto })
  upload: AttachmentUploadFormDto;
}

export class PrepareAttachmentUploadsDataDto {
  @ApiProperty({ type: [PreparedAttachmentDto] })
  attachments: PreparedAttachmentDto[];
}

export class PrepareAttachmentUploadsResponseDto implements ApiSuccessResponse<PrepareAttachmentUploadsDataDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: PrepareAttachmentUploadsDataDto })
  data: PrepareAttachmentUploadsDataDto;
}

export class AttachmentResponseDto implements ApiSuccessResponse<AttachmentDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: AttachmentDto })
  data: AttachmentDto;
}

export class AttachmentsListDataDto {
  @ApiProperty({ type: [AttachmentDto] })
  attachments: AttachmentDto[];
}

export class AttachmentsListResponseDto implements ApiSuccessResponse<AttachmentsListDataDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: AttachmentsListDataDto })
  data: AttachmentsListDataDto;
}

export class AttachmentDownloadDataDto {
  @ApiProperty({
    description:
      'Short-lived signed URL. Do not store it in frontend state permanently.',
  })
  url: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}

export class AttachmentDownloadResponseDto implements ApiSuccessResponse<AttachmentDownloadDataDto> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: AttachmentDownloadDataDto })
  data: AttachmentDownloadDataDto;
}

export class AttachmentsErrorDto {
  @ApiProperty({ example: 'ATTACHMENT_NOT_READY' })
  code: string;

  @ApiProperty({ example: 'Attachment is not ready for download.' })
  message: string;

  @ApiProperty({ type: 'object', nullable: true, additionalProperties: true })
  details: null | Record<string, unknown>;
}

export class AttachmentsErrorResponseDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ type: AttachmentsErrorDto })
  error: AttachmentsErrorDto;
}

export class AttachmentEventAcceptedResponseDto implements ApiSuccessResponse<null> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({
    type: 'object',
    additionalProperties: false,
    example: null,
    nullable: true,
  })
  data: null;
}
