import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentScanStatus } from '@generated/prisma/enums';

import { AttachmentUploadService } from '../../attachment-upload.service';
import type { StoredAttachment } from '../../attachments.types';
import type { PrepareAttachmentUploadsDto } from '../../dto/prepare-attachment-uploads.dto';
import type { CreatePendingAttachmentInput } from '../../infrastructure/attachments.repository';
import type { CreateAttachmentUploadPolicyInput } from '../../infrastructure/gcs-attachments-storage.service';
import { PrepareAttachmentUploadsCommand } from '../impl/prepare-attachment-uploads.command';
import { PrepareAttachmentUploadsHandler } from './prepare-attachment-uploads.handler';

jest.mock('../../infrastructure/attachments.repository', () => ({
  AttachmentsRepository: jest.fn(),
}));

describe('PrepareAttachmentUploadsHandler', () => {
  const now = new Date('2026-09-09T08:00:00.000Z');
  let repository: {
    createPendingMany: jest.MockedFunction<
      (
        inputs: readonly CreatePendingAttachmentInput[],
      ) => Promise<StoredAttachment[]>
    >;
  };
  let storage: {
    createUploadPolicy: jest.MockedFunction<
      (input: CreateAttachmentUploadPolicyInput) => Promise<{
        url: string;
        fields: Record<string, string>;
        expiresAt: Date;
      }>
    >;
  };
  let handler: PrepareAttachmentUploadsHandler;

  beforeEach(() => {
    repository = {
      createPendingMany: jest.fn(
        (inputs: readonly CreatePendingAttachmentInput[]) =>
          Promise.resolve(
            inputs.map((input, index) =>
              storedAttachment({
                ...input,
                createdAt: new Date(now.getTime() + index),
              }),
            ),
          ),
      ),
    };
    storage = {
      createUploadPolicy: jest
        .fn()
        .mockImplementation((input: CreateAttachmentUploadPolicyInput) =>
          Promise.resolve({
            url: 'https://storage.googleapis.com/unscanned',
            fields: { key: input.objectKey, policy: 'signed-policy' },
            expiresAt: input.expiresAt,
          }),
        ),
    };
    handler = new PrepareAttachmentUploadsHandler(
      repository as never,
      new AttachmentUploadService(
        storage as never,
        new ConfigService({
          ATTACHMENTS_MAX_FILE_SIZE_BYTES: 10_485_760,
          ATTACHMENTS_MAX_FILES_PER_REQUEST: 10,
          ATTACHMENTS_UPLOAD_EXPIRES_SECONDS: 600,
        }),
      ),
    );
  });

  it('prepares all forms and persists all records as one batch', async () => {
    const dto: PrepareAttachmentUploadsDto = {
      files: [
        {
          fileName: 'first.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 3_145_728,
          description: 'First',
        },
        {
          fileName: 'second.png',
          contentType: 'image/png',
          sizeBytes: 2_000_000,
        },
      ],
    };

    const result = await handler.execute(
      new PrepareAttachmentUploadsCommand('tenant-1', dto),
    );

    expect(storage.createUploadPolicy).toHaveBeenCalledTimes(2);
    expect(repository.createPendingMany).toHaveBeenCalledTimes(1);
    const storedInputs = repository.createPendingMany.mock.calls[0][0];

    expect(storedInputs).toHaveLength(2);
    expect(storedInputs[0].tenantId).toBe('tenant-1');
    expect(storedInputs[0].fileName).toBe('first.jpg');
    expect(storedInputs[0].objectKey).toMatch(
      /^tenants\/tenant-1\/attachments\/[0-9a-f-]+\.jpg$/,
    );
    expect(storedInputs[1].fileName).toBe('second.png');
    expect(storedInputs[1].objectKey).toMatch(
      /^tenants\/tenant-1\/attachments\/[0-9a-f-]+\.png$/,
    );
    expect(result.data.attachments).toHaveLength(2);
    expect(result.data.attachments[0].attachment.fileName).toBe('first.jpg');
    expect(result.data.attachments[0].attachment.status).toBe(
      AttachmentScanStatus.pending_upload,
    );
    expect(result.data.attachments[0].attachment.canDownload).toBe(false);
    expect(result.data.attachments[0].upload.fields.policy).toBe(
      'signed-policy',
    );
    expect(result.data.attachments[0].upload.method).toBe('POST');
  });

  it('rejects a file above the configured size before signing anything', async () => {
    await expect(
      handler.execute(
        new PrepareAttachmentUploadsCommand('tenant-1', {
          files: [
            {
              fileName: 'large.jpg',
              contentType: 'image/jpeg',
              sizeBytes: 10_485_761,
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storage.createUploadPolicy).not.toHaveBeenCalled();
    expect(repository.createPendingMany).not.toHaveBeenCalled();
  });
});

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
