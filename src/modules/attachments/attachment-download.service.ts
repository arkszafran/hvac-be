import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentScanStatus } from '@generated/prisma/enums';

import { apiError } from '../../common/types/api-response.type';
import { ATTACHMENTS_ERROR_CODES } from './attachments.constants';
import type {
  AttachmentDownloadLink,
  DownloadableAttachment,
} from './attachments.types';
import { GcsAttachmentsStorageService } from './infrastructure/gcs-attachments-storage.service';

export type AvailableAttachmentDownload<
  TAttachment extends DownloadableAttachment,
> = {
  readonly attachment: TAttachment;
  readonly link: AttachmentDownloadLink;
};

@Injectable()
export class AttachmentDownloadService {
  private readonly logger = new Logger(AttachmentDownloadService.name);
  private readonly downloadExpiresSeconds: number;

  constructor(
    private readonly storage: GcsAttachmentsStorageService,
    configService: ConfigService,
  ) {
    this.downloadExpiresSeconds = Number(
      configService.getOrThrow<string | number>(
        'ATTACHMENTS_DOWNLOAD_EXPIRES_SECONDS',
      ),
    );
  }

  async createDownloadLink(
    tenantId: string,
    attachment: DownloadableAttachment,
  ): Promise<AttachmentDownloadLink> {
    this.assertDownloadable(tenantId, attachment);

    return this.storage.createDownloadUrl({
      objectKey: attachment.objectKey,
      fileName: attachment.fileName,
      storageGeneration: attachment.storageGeneration,
      expiresAt: this.createExpiry(),
    });
  }

  async createAvailableDownloadLinks<
    TAttachment extends DownloadableAttachment,
  >(
    tenantId: string,
    attachments: readonly TAttachment[],
  ): Promise<Array<AvailableAttachmentDownload<TAttachment>>> {
    const expiresAt = this.createExpiry();
    const links = await Promise.all(
      attachments.map(async (attachment) => {
        try {
          this.assertDownloadable(tenantId, attachment);
          const link = await this.storage.createDownloadUrl({
            objectKey: attachment.objectKey,
            fileName: attachment.fileName,
            storageGeneration: attachment.storageGeneration,
            expiresAt,
          });

          return { attachment, link };
        } catch {
          this.logger.warn(
            `Skipping attachment ${attachment.id}: a download URL could not be generated.`,
          );
          return null;
        }
      }),
    );

    return links.filter(
      (item): item is AvailableAttachmentDownload<TAttachment> => item !== null,
    );
  }

  private assertDownloadable(
    tenantId: string,
    attachment: DownloadableAttachment,
  ): void {
    if (
      attachment.tenantId !== tenantId ||
      !attachment.objectKey.startsWith(`tenants/${tenantId}/attachments/`)
    ) {
      throw new Error('Attachment storage reference is invalid.');
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
  }

  private createExpiry(): Date {
    return new Date(Date.now() + this.downloadExpiresSeconds * 1000);
  }
}
