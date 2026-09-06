export class GetDeviceDetailsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly deviceId: string,
  ) {}
}
