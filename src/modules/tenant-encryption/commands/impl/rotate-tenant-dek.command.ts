export class RotateTenantDekCommand {
  constructor(
    readonly tenantId: string,
    readonly batchSize = 100,
  ) {}
}
