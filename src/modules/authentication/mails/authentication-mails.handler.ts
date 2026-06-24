import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';

import {
  type JobHandler,
  JobsHandlersRegistry,
} from '../../../common/queues/jobs-handlers.registry';
import { Queue } from '../../../common/queues/queues.enum';
import { AuthenticationMailType } from './authentication-mail-type.enum';
import type { AuthEmailJobPayload } from './authentication-mail.types';
import { AccountUnlockMailHandler } from './handlers/account-unlock-mail.handler';
import { PasswordResetMailHandler } from './handlers/password-reset-mail.handler';

@Injectable()
export class AuthenticationMailsHandler
  implements OnModuleInit, JobHandler<AuthEmailJobPayload>
{
  constructor(
    private readonly registry: JobsHandlersRegistry,
    private readonly accountUnlockMailHandler: AccountUnlockMailHandler,
    private readonly passwordResetMailHandler: PasswordResetMailHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(Queue.AUTH_EMAIL, this);
  }

  async handle(payload: AuthEmailJobPayload): Promise<void> {
    switch (payload.type) {
      case AuthenticationMailType.ACCOUNT_UNLOCK:
        await this.accountUnlockMailHandler.handle(payload.userId);
        return;
      case AuthenticationMailType.PASSWORD_RESET:
        await this.passwordResetMailHandler.handle(payload.userId);
        return;
      default:
        throw new BadRequestException('Unsupported authentication email type.');
    }
  }
}
