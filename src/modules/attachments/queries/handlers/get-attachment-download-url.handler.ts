import { NotFoundException } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { ATTACHMENTS_ERROR_CODES } from '../../attachments.constants';
import { AttachmentDownloadService } from '../../attachment-download.service';
import type { AttachmentDownloadDataDto } from '../../dto/attachment-response.dto';
import { AttachmentsReadRepository } from '../../infrastructure/attachments.read-repository';
import { GetAttachmentDownloadUrlQuery } from '../impl/get-attachment-download-url.query';

@QueryHandler(GetAttachmentDownloadUrlQuery)
export class GetAttachmentDownloadUrlHandler implements IQueryHandler<
  GetAttachmentDownloadUrlQuery,
  ApiSuccessResponse<AttachmentDownloadDataDto>
> {
  constructor(
    private readonly attachmentsReadRepository: AttachmentsReadRepository,
    private readonly attachmentDownloadService: AttachmentDownloadService,
  ) {}

  async execute(
    query: GetAttachmentDownloadUrlQuery,
  ): Promise<ApiSuccessResponse<AttachmentDownloadDataDto>> {
    const attachment = await this.attachmentsReadRepository.findByTenantAndId(
      query.tenantId,
      query.attachmentId,
    );

    if (!attachment) {
      throw new NotFoundException(
        apiError({
          code: ATTACHMENTS_ERROR_CODES.notFound,
          message: 'Attachment was not found.',
        }),
      );
    }

    const link = await this.attachmentDownloadService.createDownloadLink(
      query.tenantId,
      attachment,
    );

    return apiSuccess({
      url: link.url,
      expiresAt: link.expiresAt.toISOString(),
    });
  }
}
