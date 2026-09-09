import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { StoredAttachment } from '../attachments.types';

const ATTACHMENT_SELECT = {
  id: true,
  tenantId: true,
  fileName: true,
  objectKey: true,
  contentType: true,
  sizeBytes: true,
  scanStatus: true,
  storageGeneration: true,
  uploadExpiresAt: true,
  uploadedAt: true,
  scanCompletedAt: true,
  failureCode: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PhotoAttachmentSelect;

@Injectable()
export class AttachmentsReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTenantAndId(
    tenantId: string,
    attachmentId: string,
  ): Promise<StoredAttachment | null> {
    return this.prisma.photoAttachment.findFirst({
      where: {
        id: attachmentId,
        tenantId,
      },
      select: ATTACHMENT_SELECT,
    });
  }

  findByTenantAndIds(
    tenantId: string,
    attachmentIds: readonly string[],
  ): Promise<StoredAttachment[]> {
    return this.prisma.photoAttachment.findMany({
      where: {
        tenantId,
        id: { in: [...attachmentIds] },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: ATTACHMENT_SELECT,
    });
  }
}
