import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomerType } from '@generated/prisma/enums';

import { CreateCustomerDto } from './create-customer.dto';

describe('CreateCustomerDto', () => {
  const requiredFields = {
    type: CustomerType.individual,
    phone: '500600700',
    email: 'jan@example.com',
    address: 'Długa 1',
    postalCode: '00-001',
    city: 'Warszawa',
  };

  it.each([
    ['omitted', {}],
    ['empty', { companyName: '', fullName: '' }],
    ['null', { companyName: null, fullName: null }],
  ])('accepts %s customer names', async (_case, names) => {
    const dto = plainToInstance(CreateCustomerDto, {
      ...requiredFields,
      ...names,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
