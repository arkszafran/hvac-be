import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AttachmentScanStatus } from '@generated/prisma/enums';

import { PubSubMessageDecoderService } from '../../../../common/pubsub/pubsub-message-decoder.service';
import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { canTransitionAttachmentStatus } from '../../attachment-status.policy';
import { AttachmentUploadService } from '../../attachment-upload.service';
import {
  ATTACHMENTS_ERROR_CODES,
  ATTACHMENTS_FAILURE_CODES,
} from '../../attachments.constants';
import { AttachmentsRepository } from '../../infrastructure/attachments.repository';
import { GcsAttachmentsStorageService } from '../../infrastructure/gcs-attachments-storage.service';
import { ProcessAttachmentFileEventCommand } from '../impl/process-attachment-file-event.command';

type StorageObjectData = {
  readonly bucket: string;
  readonly name: string;
  readonly generation: string;
  readonly sizeBytes: number;
  readonly contentType: string;
};

type StorageEventDestination = {
  readonly status: AttachmentScanStatus;
  readonly scanState: string;
  readonly final: boolean;
};

@CommandHandler(ProcessAttachmentFileEventCommand)
export class ProcessAttachmentFileEventHandler implements ICommandHandler<
  ProcessAttachmentFileEventCommand,
  ApiSuccessResponse<null>
> {
  private readonly logger = new Logger(ProcessAttachmentFileEventHandler.name);
  private readonly expectedSubscription: string;
  private readonly destinations: ReadonlyMap<string, StorageEventDestination>;

  constructor(
    private readonly attachmentsRepository: AttachmentsRepository,
    private readonly decoder: PubSubMessageDecoderService,
    private readonly storage: GcsAttachmentsStorageService,
    private readonly attachmentUploadService: AttachmentUploadService,
    configService: ConfigService,
  ) {
    this.expectedSubscription = configService.getOrThrow<string>(
      'ATTACHMENTS_PUBSUB_SUBSCRIPTION',
    );
    this.destinations = new Map([
      [
        configService.getOrThrow<string>('ATTACHMENTS_UNSCANNED_BUCKET'),
        {
          status: AttachmentScanStatus.scanning,
          scanState: 'SCANNING',
          final: false,
        },
      ],
      [
        configService.getOrThrow<string>('ATTACHMENTS_CLEAN_BUCKET'),
        {
          status: AttachmentScanStatus.clean,
          scanState: 'CLEAN',
          final: true,
        },
      ],
      [
        configService.getOrThrow<string>('ATTACHMENTS_QUARANTINED_BUCKET'),
        {
          status: AttachmentScanStatus.quarantined,
          scanState: 'QUARANTINED',
          final: true,
        },
      ],
    ]);
  }

  async execute(
    command: ProcessAttachmentFileEventCommand,
  ): Promise<ApiSuccessResponse<null>> {
    const { envelope } = command;

    if (envelope.subscription !== this.expectedSubscription) {
      throwInvalidEvent('Pub/Sub subscription is not allowed.');
    }

    const attributes = envelope.message.attributes ?? {};

    if (attributes.eventType !== 'OBJECT_FINALIZE') {
      throwInvalidEvent('Only OBJECT_FINALIZE events are supported.');
    }

    const object = parseStorageObjectData(
      this.decoder.decodeJson(envelope.message.data),
    );
    const destination = this.destinations.get(object.bucket);

    if (!destination) {
      throwInvalidEvent('Storage bucket is not allowed.');
    }

    if (
      attributes.scanState !== destination.scanState ||
      (attributes.bucketId && attributes.bucketId !== object.bucket) ||
      (attributes.objectId && attributes.objectId !== object.name) ||
      (attributes.objectGeneration &&
        attributes.objectGeneration !== object.generation)
    ) {
      throwInvalidEvent('Storage event attributes do not match its payload.');
    }

    const attachment = await this.attachmentsRepository.findByObjectKey(
      object.name,
    );

    if (!attachment) {
      this.logger.warn(
        `Ignoring storage event ${envelope.message.messageId} for unknown object ${object.name}.`,
      );

      return apiSuccess();
    }

    const cleanMetadata =
      destination.status === AttachmentScanStatus.clean
        ? await this.storage.getCleanObjectMetadata(
            object.name,
            object.generation,
          )
        : null;
    const metadataMatches =
      this.attachmentUploadService.isMatchingUploadedFile({
        expectedContentType: attachment.contentType,
        expectedSizeBytes: attachment.sizeBytes,
        actualContentType: object.contentType,
        actualSizeBytes: object.sizeBytes,
      }) &&
      (!cleanMetadata ||
        (cleanMetadata.sizeBytes === object.sizeBytes &&
          cleanMetadata.contentType === object.contentType &&
          cleanMetadata.generation === object.generation));
    const nextStatus = metadataMatches
      ? destination.status
      : AttachmentScanStatus.quarantined;

    if (!canTransitionAttachmentStatus(attachment.scanStatus, nextStatus)) {
      this.logger.log(
        `Ignoring stale storage event ${envelope.message.messageId} for ${object.name}: ${attachment.scanStatus} -> ${nextStatus}.`,
      );

      return apiSuccess();
    }

    const occurredAt = parseEventTime(
      attributes.eventTime,
      envelope.message.publishTime,
    );
    const updated = await this.attachmentsRepository.updateFromStorageEvent({
      id: attachment.id,
      expectedStatus: attachment.scanStatus,
      nextStatus,
      contentType: object.contentType,
      sizeBytes: object.sizeBytes,
      storageGeneration: object.generation,
      uploadedAt: attachment.uploadedAt ?? occurredAt,
      scanCompletedAt:
        destination.final || nextStatus === AttachmentScanStatus.quarantined
          ? occurredAt
          : null,
      failureCode: metadataMatches
        ? null
        : ATTACHMENTS_FAILURE_CODES.metadataMismatch,
    });

    if (!updated) {
      this.logger.log(
        `Attachment ${attachment.id} changed concurrently while processing message ${envelope.message.messageId}.`,
      );
    }

    return apiSuccess();
  }
}

function parseStorageObjectData(value: unknown): StorageObjectData {
  if (!isRecord(value)) {
    throwInvalidEvent('Storage event data must be an object.');
  }

  const sizeBytes = Number(value.size);

  if (
    typeof value.bucket !== 'string' ||
    !value.bucket ||
    typeof value.name !== 'string' ||
    !value.name ||
    typeof value.generation !== 'string' ||
    !value.generation ||
    typeof value.contentType !== 'string' ||
    !value.contentType ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 1
  ) {
    throwInvalidEvent('Storage object data is invalid.');
  }

  return {
    bucket: value.bucket,
    name: value.name,
    generation: value.generation,
    sizeBytes,
    contentType: value.contentType,
  };
}

function parseEventTime(
  eventTime: string | undefined,
  publishTime: string | undefined,
): Date {
  for (const candidate of [eventTime, publishTime]) {
    if (candidate) {
      const timestamp = new Date(candidate);

      if (!Number.isNaN(timestamp.getTime())) {
        return timestamp;
      }
    }
  }

  return new Date();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function throwInvalidEvent(message: string): never {
  throw new BadRequestException(
    apiError({
      code: ATTACHMENTS_ERROR_CODES.pubSubMessageInvalid,
      message,
    }),
  );
}
