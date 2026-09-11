import { ServiceOrdersReadRepository } from './service-orders.read-repository';

jest.mock('../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('ServiceOrdersReadRepository projections', () => {
  it('does not select attachments for the list endpoint', async () => {
    let capturedArgs: { select: Record<string, unknown> } | undefined;
    const findMany = jest.fn((args: { select: Record<string, unknown> }) => {
      capturedArgs = args;
      return Promise.resolve([]);
    });
    const repository = new ServiceOrdersReadRepository({
      serviceOrder: { findMany },
    } as never);

    await repository.findList({ tenantId: 'tenant-1' });

    if (!capturedArgs) throw new Error('findMany was not called.');
    const select = capturedArgs.select;
    const deviceSelect = (select.devices as { select: Record<string, unknown> })
      .select;

    expect(select).not.toHaveProperty('photoAttachments');
    expect(deviceSelect).not.toHaveProperty('photoAttachments');
  });

  it('does not select any attachment relation for omitted details', async () => {
    let capturedArgs: { select: Record<string, unknown> } | undefined;
    const findFirst = jest.fn((args: { select: Record<string, unknown> }) => {
      capturedArgs = args;
      return Promise.resolve(null);
    });
    const repository = new ServiceOrdersReadRepository({
      serviceOrder: { findFirst },
    } as never);

    await repository.findDetailsWithoutAttachments('tenant-1', 'order-1');

    if (!capturedArgs) throw new Error('findFirst was not called.');
    const select = capturedArgs.select;
    const relationSelects = ['rooms', 'devices', 'notes'].map(
      (relation) =>
        (select[relation] as { select: Record<string, unknown> }).select,
    );

    expect(select).not.toHaveProperty('photoAttachments');
    for (const relationSelect of relationSelects) {
      expect(relationSelect).not.toHaveProperty('photoAttachments');
    }
  });
});
