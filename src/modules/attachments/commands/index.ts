import { PrepareAttachmentUploadsHandler } from './handlers/prepare-attachment-uploads.handler';
import { ProcessAttachmentFileEventHandler } from './handlers/process-attachment-file-event.handler';

export const AttachmentsCommandHandlers = [
  PrepareAttachmentUploadsHandler,
  ProcessAttachmentFileEventHandler,
];
