import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@generated/prisma/enums';

import { apiError } from '../../common/types/api-response.type';
import { AUTH_ERROR_CODES } from './authentication.constants';
import { AuthenticationMailQueueService } from './mails/authentication-mail-queue.service';
import { AuthenticationMailType } from './mails/authentication-mail-type.enum';

type AccountStatusUser = {
  readonly id: string;
  readonly status: UserStatus;
  readonly accountUnlockCodeHash: string | null;
};

@Injectable()
export class AuthenticationAccountStatusService {
  constructor(
    private readonly mailQueueService: AuthenticationMailQueueService,
  ) {}

  async throwIfBlocked({
    id,
    status,
    accountUnlockCodeHash,
  }: AccountStatusUser): Promise<void> {
    if (status !== UserStatus.blocked) {
      return;
    }

    if (!accountUnlockCodeHash) {
      await this.mailQueueService.queueEmail({
        userId: id,
        type: AuthenticationMailType.ACCOUNT_UNLOCK,
      });
    }

    throw new UnauthorizedException(
      apiError({
        code: AUTH_ERROR_CODES.loginRetriesLimitReached,
        message: 'Login retries limit reached.',
      }),
    );
  }
}
