import type { CreatePendingAttachmentInput } from './attachments.repository';
import { AttachmentsRepository } from './attachments.repository';

jest.mock('../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('AttachmentsRepository', () => {
  it('uses the provided transaction and persists the attachment owner', async () => {
    const created = { id: 'attachment-1' };
    const create = jest.fn((input: unknown) => {
      void input;
      return Promise.resolve(created);
    });
    const transaction = { photoAttachment: { create } };
    const prisma = { $transaction: jest.fn() };
    const repository = new AttachmentsRepository(prisma as never);

    const result = await repository.createPendingMany(
      [pendingAttachment()],
      transaction as never,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    const createInput = create.mock.calls[0][0] as {
      readonly data: Record<string, unknown>;
    };

    expect(createInput.data).toEqual(
      expect.objectContaining({
        id: 'attachment-1',
        tenantId: 'tenant-1',
        visitId: 'visit-1',
        sortOrder: 2,
      }),
    );
    expect(result).toEqual([created]);
  });

  it('opens its own transaction when no transaction is provided', async () => {
    const create = jest.fn((input: unknown) => {
      void input;
      return Promise.resolve({ id: 'attachment-1' });
    });
    const prisma = {
      $transaction: jest.fn((work: (transaction: object) => Promise<unknown>) =>
        work({ photoAttachment: { create } }),
      ),
    };
    const repository = new AttachmentsRepository(prisma as never);

    await repository.createPendingMany([pendingAttachment()]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

function pendingAttachment(): CreatePendingAttachmentInput {
  return {
    id: 'attachment-1',
    tenantId: 'tenant-1',
    fileName: 'unit.jpg',
    objectKey: 'tenants/tenant-1/attachments/attachment-1.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 500,
    uploadExpiresAt: new Date('2026-09-09T08:10:00.000Z'),
    description: null,
    owner: { kind: 'visit', visitId: 'visit-1' },
    sortOrder: 2,
  };
}
