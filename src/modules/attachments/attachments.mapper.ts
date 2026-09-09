import { AttachmentScanStatus } from '@generated/prisma/enums';

import type { AttachmentDto } from './dto/attachment-response.dto';
import type { StoredAttachment } from './attachments.types';

export function mapAttachmentDto(attachment: StoredAttachment): AttachmentDto {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    status: attachment.scanStatus,
    canDownload: attachment.scanStatus === AttachmentScanStatus.clean,
    description: attachment.description,
    uploadExpiresAt: attachment.uploadExpiresAt.toISOString(),
    uploadedAt: attachment.uploadedAt?.toISOString() ?? null,
    scanCompletedAt: attachment.scanCompletedAt?.toISOString() ?? null,
    createdAt: attachment.createdAt.toISOString(),
    updatedAt: attachment.updatedAt.toISOString(),
  };
}
