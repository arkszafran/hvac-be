import { ConfigService } from '@nestjs/config';
import { AttachmentScanStatus } from '@generated/prisma/enums';

import type { PubSubPushEnvelopeDto } from '../../../../common/pubsub/dto/pubsub-push-envelope.dto';
import { PubSubMessageDecoderService } from '../../../../common/pubsub/pubsub-message-decoder.service';
import { AttachmentUploadService } from '../../attachment-upload.service';
import type { StoredAttachment } from '../../attachments.types';
import { ProcessAttachmentFileEventCommand } from '../impl/process-attachment-file-event.command';
import { ProcessAttachmentFileEventHandler } from './process-attachment-file-event.handler';

jest.mock('../../infrastructure/attachments.repository', () => ({
  AttachmentsRepository: jest.fn(),
}));

describe('ProcessAttachmentFileEventHandler', () => {
  let repository: {
    findByObjectKey: jest.Mock;
    updateFromStorageEvent: jest.Mock;
  };
  let storage: { getCleanObjectMetadata: jest.Mock };
  let handler: ProcessAttachmentFileEventHandler;

  beforeEach(() => {
    repository = {
      findByObjectKey: jest.fn(),
      updateFromStorageEvent: jest.fn(),
    };
    storage = {
      getCleanObjectMetadata: jest.fn().mockResolvedValue({
        contentType: 'image/jpeg',
        sizeBytes: 100,
        generation: '1234567890',
      }),
    };
    const config = new ConfigService({
      ATTACHMENTS_PUBSUB_SUBSCRIPTION:
        'projects/hvac-attachments-dev/subscriptions/attachment-file-events-local',
      ATTACHMENTS_MAX_FILE_SIZE_BYTES: 10_485_760,
      ATTACHMENTS_MAX_FILES_PER_REQUEST: 10,
      ATTACHMENTS_UPLOAD_EXPIRES_SECONDS: 600,
      ATTACHMENTS_UNSCANNED_BUCKET: 'unscanned-bucket',
      ATTACHMENTS_CLEAN_BUCKET: 'clean-bucket',
      ATTACHMENTS_QUARANTINED_BUCKET: 'quarantined-bucket',
    });
    handler = new ProcessAttachmentFileEventHandler(
      repository as never,
      new PubSubMessageDecoderService(),
      storage as never,
      new AttachmentUploadService(storage as never, config),
      config,
    );
  });

  it('moves a matching attachment to clean', async () => {
    const attachment = storedAttachment({
      scanStatus: AttachmentScanStatus.scanning,
    });
    repository.findByObjectKey.mockResolvedValue(attachment);
    repository.updateFromStorageEvent.mockResolvedValue(
      storedAttachment({ scanStatus: AttachmentScanStatus.clean }),
    );

    await expect(
      handler.execute(
        new ProcessAttachmentFileEventCommand(
          envelope({ bucket: 'clean-bucket', scanState: 'CLEAN' }),
        ),
      ),
    ).resolves.toEqual({ success: true, data: null });

    expect(repository.updateFromStorageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: attachment.id,
        expectedStatus: AttachmentScanStatus.scanning,
        nextStatus: AttachmentScanStatus.clean,
        storageGeneration: '1234567890',
        failureCode: null,
      }),
    );
    expect(storage.getCleanObjectMetadata).toHaveBeenCalledWith(
      'tenants/tenant-1/attachments/attachment-1.jpg',
      '1234567890',
    );
  });

  it('never lets a late clean event override quarantine', async () => {
    repository.findByObjectKey.mockResolvedValue(
      storedAttachment({ scanStatus: AttachmentScanStatus.quarantined }),
    );

    await handler.execute(
      new ProcessAttachmentFileEventCommand(
        envelope({ bucket: 'clean-bucket', scanState: 'CLEAN' }),
      ),
    );

    expect(repository.updateFromStorageEvent).not.toHaveBeenCalled();
  });

  it('fails closed when final object metadata differs from the request', async () => {
    repository.findByObjectKey.mockResolvedValue(storedAttachment());
    repository.updateFromStorageEvent.mockResolvedValue(
      storedAttachment({ scanStatus: AttachmentScanStatus.quarantined }),
    );

    await handler.execute(
      new ProcessAttachmentFileEventCommand(
        envelope({
          bucket: 'clean-bucket',
          scanState: 'CLEAN',
          contentType: 'image/png',
        }),
      ),
    );

    expect(repository.updateFromStorageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        nextStatus: AttachmentScanStatus.quarantined,
        failureCode: 'FILE_METADATA_MISMATCH',
      }),
    );
  });
});

function envelope(input: {
  readonly bucket: string;
  readonly scanState: string;
  readonly contentType?: string;
}): PubSubPushEnvelopeDto {
  const name = 'tenants/tenant-1/attachments/attachment-1.jpg';
  const generation = '1234567890';
  const data = {
    bucket: input.bucket,
    name,
    generation,
    size: '100',
    contentType: input.contentType ?? 'image/jpeg',
  };

  return {
    subscription:
      'projects/hvac-attachments-dev/subscriptions/attachment-file-events-local',
    message: {
      data: Buffer.from(JSON.stringify(data)).toString('base64'),
      messageId: 'message-1',
      publishTime: '2026-09-09T08:01:00.000Z',
      attributes: {
        eventType: 'OBJECT_FINALIZE',
        scanState: input.scanState,
        bucketId: input.bucket,
        objectId: name,
        objectGeneration: generation,
        eventTime: '2026-09-09T08:01:00.000Z',
      },
    },
  };
}

function storedAttachment(
  overrides: Partial<StoredAttachment> = {},
): StoredAttachment {
  return {
    id: 'attachment-1',
    tenantId: 'tenant-1',
    fileName: 'file.jpg',
    objectKey: 'tenants/tenant-1/attachments/attachment-1.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 100,
    scanStatus: AttachmentScanStatus.pending_upload,
    storageGeneration: null,
    uploadExpiresAt: new Date('2026-09-09T08:10:00.000Z'),
    uploadedAt: null,
    scanCompletedAt: null,
    failureCode: null,
    description: null,
    createdAt: new Date('2026-09-09T08:00:00.000Z'),
    updatedAt: new Date('2026-09-09T08:00:00.000Z'),
    ...overrides,
  };
}
