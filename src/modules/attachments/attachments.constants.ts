export const ATTACHMENTS_ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AttachmentAllowedContentType =
  (typeof ATTACHMENTS_ALLOWED_CONTENT_TYPES)[number];

export const ATTACHMENT_EXTENSION_BY_CONTENT_TYPE: Record<
  AttachmentAllowedContentType,
  string
> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const ATTACHMENTS_ERROR_CODES = {
  invalidRequest: 'ATTACHMENT_UPLOAD_REQUEST_INVALID',
  notFound: 'ATTACHMENT_NOT_FOUND',
  notReady: 'ATTACHMENT_NOT_READY',
  pubSubMessageInvalid: 'ATTACHMENT_PUBSUB_MESSAGE_INVALID',
} as const;

export const ATTACHMENTS_FAILURE_CODES = {
  metadataMismatch: 'FILE_METADATA_MISMATCH',
} as const;
