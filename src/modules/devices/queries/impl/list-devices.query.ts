import type { DevicesListQueryDto } from '../../dto/devices-list-query.dto';

export class ListDevicesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly dto: DevicesListQueryDto,
  ) {}
}
