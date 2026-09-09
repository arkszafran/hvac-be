import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { AttachmentScanStatus } from '@generated/prisma/enums';

import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { ATTACHMENTS_ERROR_CODES } from '../../attachments.constants';
import type { AttachmentDownloadDataDto } from '../../dto/attachment-response.dto';
import { AttachmentsReadRepository } from '../../infrastructure/attachments.read-repository';
import { GcsAttachmentsStorageService } from '../../infrastructure/gcs-attachments-storage.service';
import { GetAttachmentDownloadUrlQuery } from '../impl/get-attachment-download-url.query';

@QueryHandler(GetAttachmentDownloadUrlQuery)
export class GetAttachmentDownloadUrlHandler implements IQueryHandler<
  GetAttachmentDownloadUrlQuery,
  ApiSuccessResponse<AttachmentDownloadDataDto>
> {
  private readonly downloadExpiresSeconds: number;

  constructor(
    private readonly attachmentsReadRepository: AttachmentsReadRepository,
    private readonly storage: GcsAttachmentsStorageService,
    configService: ConfigService,
  ) {
    this.downloadExpiresSeconds = Number(
      configService.getOrThrow<string | number>(
        'ATTACHMENTS_DOWNLOAD_EXPIRES_SECONDS',
      ),
    );
  }

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

    if (attachment.scanStatus !== AttachmentScanStatus.clean) {
      throw new ConflictException(
        apiError({
          code: ATTACHMENTS_ERROR_CODES.notReady,
          message: 'Attachment is not ready for download.',
          details: { status: attachment.scanStatus },
        }),
      );
    }

    const expiresAt = new Date(Date.now() + this.downloadExpiresSeconds * 1000);
    const link = await this.storage.createDownloadUrl({
      objectKey: attachment.objectKey,
      fileName: attachment.fileName,
      storageGeneration: attachment.storageGeneration,
      expiresAt,
    });

    return apiSuccess({
      url: link.url,
      expiresAt: link.expiresAt.toISOString(),
    });
  }
}
