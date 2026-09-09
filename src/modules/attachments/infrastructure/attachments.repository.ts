import { Injectable } from '@nestjs/common';
import type { AttachmentScanStatus, Prisma } from '@generated/prisma/client';

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

export type CreatePendingAttachmentInput = {
  readonly id: string;
  readonly tenantId: string;
  readonly fileName: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadExpiresAt: Date;
  readonly description: string | null;
};

export type UpdateAttachmentFromStorageEventInput = {
  readonly id: string;
  readonly expectedStatus: AttachmentScanStatus;
  readonly nextStatus: AttachmentScanStatus;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly storageGeneration: string;
  readonly uploadedAt: Date;
  readonly scanCompletedAt: Date | null;
  readonly failureCode: string | null;
};

@Injectable()
export class AttachmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPendingMany(
    inputs: readonly CreatePendingAttachmentInput[],
  ): Promise<StoredAttachment[]> {
    return this.prisma.$transaction(
      inputs.map((input) =>
        this.prisma.photoAttachment.create({
          data: {
            id: input.id,
            tenantId: input.tenantId,
            fileName: input.fileName,
            objectKey: input.objectKey,
            contentType: input.contentType,
            sizeBytes: input.sizeBytes,
            uploadExpiresAt: input.uploadExpiresAt,
            description: input.description,
          },
          select: ATTACHMENT_SELECT,
        }),
      ),
    );
  }

  findByObjectKey(objectKey: string): Promise<StoredAttachment | null> {
    return this.prisma.photoAttachment.findUnique({
      where: { objectKey },
      select: ATTACHMENT_SELECT,
    });
  }

  async updateFromStorageEvent(
    input: UpdateAttachmentFromStorageEventInput,
  ): Promise<StoredAttachment | null> {
    const result = await this.prisma.photoAttachment.updateMany({
      where: {
        id: input.id,
        scanStatus: input.expectedStatus,
      },
      data: {
        scanStatus: input.nextStatus,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        storageGeneration: input.storageGeneration,
        uploadedAt: input.uploadedAt,
        scanCompletedAt: input.scanCompletedAt,
        failureCode: input.failureCode,
      },
    });

    if (result.count !== 1) {
      return null;
    }

    return this.prisma.photoAttachment.findUnique({
      where: { id: input.id },
      select: ATTACHMENT_SELECT,
    });
  }
}
