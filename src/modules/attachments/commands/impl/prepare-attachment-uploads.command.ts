import type { PrepareAttachmentUploadsDto } from '../../dto/prepare-attachment-uploads.dto';

export class PrepareAttachmentUploadsCommand {
  constructor(
    public readonly tenantId: string,
    public readonly dto: PrepareAttachmentUploadsDto,
  ) {}
}
