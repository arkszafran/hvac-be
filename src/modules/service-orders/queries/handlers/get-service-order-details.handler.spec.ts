import { GetServiceOrderDetailsQuery } from '../impl/get-service-order-details.query';
import { GetServiceOrderDetailsHandler } from './get-service-order-details.handler';

jest.mock('../../infrastructure/service-orders.read-repository', () => ({
  ServiceOrdersReadRepository: jest.fn(),
}));
jest.mock('../../service-orders.mapper', () => ({
  ServiceOrdersMapper: jest.fn(),
}));

describe('GetServiceOrderDetailsHandler', () => {
  it('uses the attachment-free repository projection when omission is requested', async () => {
    const row = { id: 'order-1' };
    const mapped = { attachmentsOmitted: true };
    const repository = {
      findDetailsWithoutAttachments: jest.fn().mockResolvedValue(row),
      findDetailsWithAttachments: jest.fn(),
    };
    const mapper = {
      mapDetailsWithoutAttachments: jest.fn().mockResolvedValue(mapped),
      mapDetailsWithAttachments: jest.fn(),
    };
    const handler = new GetServiceOrderDetailsHandler(
      repository as never,
      mapper as never,
    );

    const response = await handler.execute(
      new GetServiceOrderDetailsQuery('tenant-1', 'order-1', true),
    );

    expect(repository.findDetailsWithoutAttachments).toHaveBeenCalledWith(
      'tenant-1',
      'order-1',
    );
    expect(repository.findDetailsWithAttachments).not.toHaveBeenCalled();
    expect(response).toEqual({ success: true, data: mapped });
  });
});
