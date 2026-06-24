import { AuthenticationMailType } from './authentication-mail-type.enum';

export type AuthEmailJobPayload = {
  readonly userId: string;
  readonly type: AuthenticationMailType;
};
