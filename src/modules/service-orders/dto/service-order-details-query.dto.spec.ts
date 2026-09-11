import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ServiceOrderDetailsQueryDto } from './service-order-details-query.dto';

describe('ServiceOrderDetailsQueryDto', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('transforms %s into a boolean', async (input, expected) => {
    const dto = plainToInstance(
      ServiceOrderDetailsQueryDto,
      {
        ommitAttachments: input,
      },
      { enableImplicitConversion: true },
    );

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.ommitAttachments).toBe(expected);
  });
});
