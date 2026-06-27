import type { ChangePasswordDto } from '../../dto/change-password.dto';

export class ChangePasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly dto: ChangePasswordDto,
  ) {}
}
