import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';

import {
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { AttachmentUploadService } from '../../attachment-upload.service';
import { mapAttachmentDto } from '../../attachments.mapper';
import type { PrepareAttachmentUploadsDataDto } from '../../dto/attachment-response.dto';
import { AttachmentsRepository } from '../../infrastructure/attachments.repository';
import { PrepareAttachmentUploadsCommand } from '../impl/prepare-attachment-uploads.command';

@CommandHandler(PrepareAttachmentUploadsCommand)
export class PrepareAttachmentUploadsHandler implements ICommandHandler<
  PrepareAttachmentUploadsCommand,
  ApiSuccessResponse<PrepareAttachmentUploadsDataDto>
> {
  constructor(
    private readonly attachmentsRepository: AttachmentsRepository,
    private readonly attachmentUploadService: AttachmentUploadService,
  ) {}

  async execute(
    command: PrepareAttachmentUploadsCommand,
  ): Promise<ApiSuccessResponse<PrepareAttachmentUploadsDataDto>> {
    const pending = this.attachmentUploadService.preparePendingAttachments({
      tenantId: command.tenantId,
      files: command.dto.files.map((file) => ({ id: randomUUID(), ...file })),
    });
    const storedAttachments =
      await this.attachmentsRepository.createPendingMany(pending);
    const forms =
      await this.attachmentUploadService.createUploadForms(storedAttachments);

    return apiSuccess({
      attachments: storedAttachments.map((attachment, index) => ({
        attachment: mapAttachmentDto(attachment),
        upload: {
          method: forms[index].method,
          url: forms[index].url,
          fields: forms[index].fields,
          expiresAt: forms[index].expiresAt.toISOString(),
        },
      })),
    });
  }
}
