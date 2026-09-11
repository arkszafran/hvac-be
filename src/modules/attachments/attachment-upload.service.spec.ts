import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AttachmentUploadService } from './attachment-upload.service';

describe('AttachmentUploadService', () => {
  const storage = { createUploadPolicy: jest.fn() };
  const service = new AttachmentUploadService(
    storage as never,
    new ConfigService({
      ATTACHMENTS_MAX_FILE_SIZE_BYTES: 1000,
      ATTACHMENTS_MAX_FILES_PER_REQUEST: 2,
      ATTACHMENTS_UPLOAD_EXPIRES_SECONDS: 600,
    }),
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates and prepares reusable pending attachment data', () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-09-09T08:00:00.000Z').getTime());

    const [attachment] = service.preparePendingAttachments({
      tenantId: 'tenant-1',
      files: [
        {
          id: 'attachment-1',
          fileName: 'unit.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 500,
          description: '  Nameplate  ',
        },
      ],
    });

    expect(attachment).toEqual(
      expect.objectContaining({
        id: 'attachment-1',
        tenantId: 'tenant-1',
        objectKey: 'tenants/tenant-1/attachments/attachment-1.jpg',
        description: 'Nameplate',
        uploadExpiresAt: new Date('2026-09-09T08:10:00.000Z'),
      }),
    );
  });

  it.each([
    {
      fileName: 'bad\u0000name.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 500,
    },
    {
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: 500,
    },
    {
      fileName: 'large.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1001,
    },
  ])('rejects invalid file metadata: $fileName', (file) => {
    expect(() =>
      service.preparePendingAttachments({
        tenantId: 'tenant-1',
        files: [{ id: 'attachment-1', ...file }],
      }),
    ).toThrow(BadRequestException);
  });

  it('creates POST upload forms with the centrally configured size limit', async () => {
    const expiresAt = new Date('2026-09-09T08:10:00.000Z');
    storage.createUploadPolicy.mockResolvedValue({
      url: 'https://storage.example/upload',
      fields: { key: 'object-key' },
      expiresAt,
    });

    const [form] = await service.createUploadForms([
      {
        objectKey: 'tenants/tenant-1/attachments/attachment-1.jpg',
        contentType: 'image/jpeg',
        uploadExpiresAt: expiresAt,
      },
    ]);

    expect(storage.createUploadPolicy).toHaveBeenCalledWith({
      objectKey: 'tenants/tenant-1/attachments/attachment-1.jpg',
      contentType: 'image/jpeg',
      maxSizeBytes: 1000,
      expiresAt,
    });
    expect(form).toEqual({
      method: 'POST',
      url: 'https://storage.example/upload',
      fields: { key: 'object-key' },
      expiresAt,
    });
  });

  it('checks finalized storage metadata against the upload policy', () => {
    expect(
      service.isMatchingUploadedFile({
        expectedContentType: 'image/jpeg',
        expectedSizeBytes: 500,
        actualContentType: 'image/jpeg',
        actualSizeBytes: 500,
      }),
    ).toBe(true);
    expect(
      service.isMatchingUploadedFile({
        expectedContentType: 'image/jpeg',
        expectedSizeBytes: 500,
        actualContentType: 'image/png',
        actualSizeBytes: 500,
      }),
    ).toBe(false);
  });
});
