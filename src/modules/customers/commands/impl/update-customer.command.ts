import type { UpdateCustomerDto } from '../../dto/update-customer.dto';

export class UpdateCustomerCommand {
  constructor(
    public readonly tenantId: string,
    public readonly customerId: string,
    public readonly dto: UpdateCustomerDto,
  ) {}
}
