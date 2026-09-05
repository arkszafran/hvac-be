export class GetCustomerDetailsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly customerId: string,
  ) {}
}
