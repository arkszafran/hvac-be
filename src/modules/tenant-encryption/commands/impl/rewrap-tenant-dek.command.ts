export class RewrapTenantDekCommand {
  constructor(
    readonly tenantId: string,
    readonly keyVersion: number,
  ) {}
}
