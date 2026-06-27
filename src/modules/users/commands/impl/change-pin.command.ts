import type { ChangePinDto } from '../../dto/change-pin.dto';

export class ChangePinCommand {
  constructor(
    public readonly userId: string,
    public readonly dto: ChangePinDto,
  ) {}
}
