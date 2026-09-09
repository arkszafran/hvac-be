import { GetAttachmentDownloadUrlHandler } from './handlers/get-attachment-download-url.handler';
import { GetAttachmentHandler } from './handlers/get-attachment.handler';
import { ListAttachmentsHandler } from './handlers/list-attachments.handler';

export const AttachmentsQueryHandlers = [
  GetAttachmentHandler,
  ListAttachmentsHandler,
  GetAttachmentDownloadUrlHandler,
];
