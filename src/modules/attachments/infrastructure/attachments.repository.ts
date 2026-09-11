import { Injectable } from '@nestjs/common';
import type { AttachmentScanStatus, Prisma } from '@generated/prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  PreparedPendingAttachment,
  StoredAttachment,
} from '../attachments.types';

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

export type CreatePendingAttachmentInput = PreparedPendingAttachment & {
  readonly owner?: AttachmentOwner;
  readonly sortOrder?: number;
};

export type AttachmentOwner =
  | { readonly kind: 'service_order'; readonly serviceOrderId: string }
  | { readonly kind: 'service_order_room'; readonly serviceOrderRoomId: string }
  | {
      readonly kind: 'service_order_device';
      readonly serviceOrderDeviceId: string;
    }
  | { readonly kind: 'service_order_note'; readonly serviceOrderNoteId: string }
  | { readonly kind: 'visit'; readonly visitId: string };

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
    transaction?: Prisma.TransactionClient,
  ): Promise<StoredAttachment[]> {
    if (inputs.length === 0) {
      return [];
    }

    if (transaction) {
      return Promise.all(
        inputs.map((input) => this.createPending(input, transaction)),
      );
    }

    return this.prisma.$transaction((createdTransaction) =>
      Promise.all(
        inputs.map((input) => this.createPending(input, createdTransaction)),
      ),
    );
  }

  private createPending(
    input: CreatePendingAttachmentInput,
    database: Pick<Prisma.TransactionClient, 'photoAttachment'>,
  ): Promise<StoredAttachment> {
    return database.photoAttachment.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        fileName: input.fileName,
        objectKey: input.objectKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        uploadExpiresAt: input.uploadExpiresAt,
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
        ...mapOwner(input.owner),
      },
      select: ATTACHMENT_SELECT,
    });
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

function mapOwner(owner: AttachmentOwner | undefined): {
  readonly serviceOrderId?: string;
  readonly serviceOrderRoomId?: string;
  readonly serviceOrderDeviceId?: string;
  readonly serviceOrderNoteId?: string;
  readonly visitId?: string;
} {
  switch (owner?.kind) {
    case 'service_order':
      return { serviceOrderId: owner.serviceOrderId };
    case 'service_order_room':
      return { serviceOrderRoomId: owner.serviceOrderRoomId };
    case 'service_order_device':
      return { serviceOrderDeviceId: owner.serviceOrderDeviceId };
    case 'service_order_note':
      return { serviceOrderNoteId: owner.serviceOrderNoteId };
    case 'visit':
      return { visitId: owner.visitId };
    default:
      return {};
  }
}
