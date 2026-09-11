import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ServiceOrderStatus } from '@generated/prisma/enums';

import { ServiceOrdersListQueryDto } from './service-orders-list-query.dto';

describe('ServiceOrdersListQueryDto', () => {
  it('accepts repeated and comma-separated statuses', async () => {
    const dto = plainToInstance(ServiceOrdersListQueryDto, {
      statuses: ['new, completed', 'cancelled'],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.statuses).toEqual([
      ServiceOrderStatus.new,
      ServiceOrderStatus.completed,
      ServiceOrderStatus.cancelled,
    ]);
  });
});
