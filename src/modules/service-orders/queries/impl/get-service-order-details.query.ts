export class GetServiceOrderDetailsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly serviceOrderId: string,
    public readonly omitAttachments: boolean,
  ) {}
}
