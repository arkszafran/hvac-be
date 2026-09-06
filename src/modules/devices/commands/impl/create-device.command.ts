import type { CreateDeviceDto } from '../../dto/create-device.dto';

export class CreateDeviceCommand {
  constructor(
    public readonly tenantId: string,
    public readonly dto: CreateDeviceDto,
  ) {}
}
