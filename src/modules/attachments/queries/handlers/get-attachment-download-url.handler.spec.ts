import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentScanStatus } from '@generated/prisma/enums';

import type { StoredAttachment } from '../../attachments.types';
import { GetAttachmentDownloadUrlQuery } from '../impl/get-attachment-download-url.query';
import { GetAttachmentDownloadUrlHandler } from './get-attachment-download-url.handler';

jest.mock('../../infrastructure/attachments.read-repository', () => ({
  AttachmentsReadRepository: jest.fn(),
}));
jest.mock('../../infrastructure/gcs-attachments-storage.service', () => ({
  GcsAttachmentsStorageService: jest.fn(),
}));

describe('GetAttachmentDownloadUrlHandler', () => {
  const repository = { findByTenantAndId: jest.fn() };
  const storage = { createDownloadUrl: jest.fn() };
  const handler = new GetAttachmentDownloadUrlHandler(
    repository as never,
    storage as never,
    new ConfigService({ ATTACHMENTS_DOWNLOAD_EXPIRES_SECONDS: 300 }),
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a link only for a clean tenant-owned attachment', async () => {
    repository.findByTenantAndId.mockResolvedValue(
      storedAttachment({ scanStatus: AttachmentScanStatus.clean }),
    );
    storage.createDownloadUrl.mockImplementation((input: { expiresAt: Date }) =>
      Promise.resolve({
        url: 'https://storage.googleapis.com/signed',
        expiresAt: input.expiresAt,
      }),
    );

    const result = await handler.execute(
      new GetAttachmentDownloadUrlQuery('tenant-1', 'attachment-1'),
    );

    expect(repository.findByTenantAndId).toHaveBeenCalledWith(
      'tenant-1',
      'attachment-1',
    );
    expect(storage.createDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: 'tenants/tenant-1/attachments/attachment-1.jpg',
      }),
    );
    expect(result.data.url).toBe('https://storage.googleapis.com/signed');
  });

  it('rejects a scanning attachment', async () => {
    repository.findByTenantAndId.mockResolvedValue(
      storedAttachment({ scanStatus: AttachmentScanStatus.scanning }),
    );

    await expect(
      handler.execute(
        new GetAttachmentDownloadUrlQuery('tenant-1', 'attachment-1'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(storage.createDownloadUrl).not.toHaveBeenCalled();
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
