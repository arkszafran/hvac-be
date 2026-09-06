import type { UpdateDeviceDto } from '../../dto/update-device.dto';

export class UpdateDeviceCommand {
  constructor(
    public readonly tenantId: string,
    public readonly deviceId: string,
    public readonly dto: UpdateDeviceDto,
  ) {}
}
