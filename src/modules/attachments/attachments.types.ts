import type { AttachmentScanStatus } from '@generated/prisma/enums';

export type StoredAttachment = {
  readonly id: string;
  readonly tenantId: string;
  readonly fileName: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly scanStatus: AttachmentScanStatus;
  readonly storageGeneration: string | null;
  readonly uploadExpiresAt: Date;
  readonly uploadedAt: Date | null;
  readonly scanCompletedAt: Date | null;
  readonly failureCode: string | null;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type AttachmentUploadPolicy = {
  readonly url: string;
  readonly fields: Record<string, string>;
  readonly expiresAt: Date;
};

export type AttachmentDownloadLink = {
  readonly url: string;
  readonly expiresAt: Date;
};
