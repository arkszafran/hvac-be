import type { CreateCustomerDto } from '../../dto/create-customer.dto';

export class CreateCustomerCommand {
  constructor(
    public readonly tenantId: string,
    public readonly dto: CreateCustomerDto,
  ) {}
}
