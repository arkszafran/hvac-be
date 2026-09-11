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

export type AttachmentUploadFile = {
  readonly id: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly description?: string | null;
};

export type PreparedPendingAttachment = AttachmentUploadFile & {
  readonly tenantId: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly description: string | null;
  readonly uploadExpiresAt: Date;
};

export type UploadableAttachment = Pick<
  PreparedPendingAttachment,
  'objectKey' | 'contentType' | 'uploadExpiresAt'
>;

export type AttachmentUploadForm = AttachmentUploadPolicy & {
  readonly method: 'POST';
};

export type AttachmentDownloadLink = {
  readonly url: string;
  readonly expiresAt: Date;
};

export type DownloadableAttachment = Pick<
  StoredAttachment,
  | 'id'
  | 'tenantId'
  | 'fileName'
  | 'objectKey'
  | 'scanStatus'
  | 'storageGeneration'
>;
