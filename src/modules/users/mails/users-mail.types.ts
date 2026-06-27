import { UsersMailType } from './users-mail-type.enum';

export type UsersEmailJobPayload = {
  readonly userId: string;
  readonly temporaryPassword: string;
  readonly type: UsersMailType;
};
