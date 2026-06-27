import type { SetupNewUserCredentialsDto } from '../../dto/setup-new-user-credentials.dto';

export class SetupNewUserCredentialsCommand {
  constructor(
    public readonly userId: string,
    public readonly dto: SetupNewUserCredentialsDto,
  ) {}
}
