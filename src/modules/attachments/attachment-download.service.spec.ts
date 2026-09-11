import { ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentScanStatus } from '@generated/prisma/enums';

import { AttachmentDownloadService } from './attachment-download.service';
import type { DownloadableAttachment } from './attachments.types';

describe('AttachmentDownloadService', () => {
  const storage = { createDownloadUrl: jest.fn() };
  const service = new AttachmentDownloadService(
    storage as never,
    new ConfigService({ ATTACHMENTS_DOWNLOAD_EXPIRES_SECONDS: 300 }),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a link only after checking tenant, object key and scan status', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-09-09T08:00:00.000Z').getTime());
    storage.createDownloadUrl.mockImplementation(
      (input: { readonly expiresAt: Date }) =>
        Promise.resolve({
          url: 'https://storage.example/download',
          expiresAt: input.expiresAt,
        }),
    );

    const result = await service.createDownloadLink('tenant-1', attachment());

    expect(storage.createDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: 'tenants/tenant-1/attachments/attachment-1.jpg',
        expiresAt: new Date('2026-09-09T08:05:00.000Z'),
      }),
    );
    expect(result.url).toBe('https://storage.example/download');
  });

  it('rejects an attachment which is not clean', async () => {
    await expect(
      service.createDownloadLink(
        'tenant-1',
        attachment({ scanStatus: AttachmentScanStatus.scanning }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(storage.createDownloadUrl).not.toHaveBeenCalled();
  });

  it('omits invalid or unsignable attachments in a batch', async () => {
    storage.createDownloadUrl
      .mockRejectedValueOnce(new Error('Signing failed'))
      .mockResolvedValueOnce({
        url: 'https://storage.example/download-3',
        expiresAt: new Date('2026-09-09T08:05:00.000Z'),
      });

    const result = await service.createAvailableDownloadLinks('tenant-1', [
      attachment({ id: 'attachment-1' }),
      attachment({
        id: 'attachment-2',
        tenantId: 'tenant-2',
        objectKey: 'tenants/tenant-2/attachments/attachment-2.jpg',
      }),
      attachment({
        id: 'attachment-3',
        objectKey: 'tenants/tenant-1/attachments/attachment-3.jpg',
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].attachment.id).toBe('attachment-3');
    expect(storage.createDownloadUrl).toHaveBeenCalledTimes(2);
  });
});

function attachment(
  overrides: Partial<DownloadableAttachment> = {},
): DownloadableAttachment {
  return {
    id: 'attachment-1',
    tenantId: 'tenant-1',
    fileName: 'unit.jpg',
    objectKey: 'tenants/tenant-1/attachments/attachment-1.jpg',
    scanStatus: AttachmentScanStatus.clean,
    storageGeneration: '10',
    ...overrides,
  };
}
