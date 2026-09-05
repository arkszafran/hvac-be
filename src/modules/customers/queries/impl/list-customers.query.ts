import type { CustomersQueryDto } from '../../dto/customers-query.dto';

export class ListCustomersQuery {
  constructor(
    public readonly tenantId: string,
    public readonly dto: CustomersQueryDto,
  ) {}
}
