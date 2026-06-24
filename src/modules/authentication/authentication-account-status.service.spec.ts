import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@generated/prisma/enums';

import { AUTH_ERROR_CODES } from './authentication.constants';
import { AuthenticationAccountStatusService } from './authentication-account-status.service';
import { AuthenticationMailType } from './mails/authentication-mail-type.enum';

describe('AuthenticationAccountStatusService', () => {
  let mailQueueService: {
    queueEmail: jest.Mock;
  };
  let service: AuthenticationAccountStatusService;

  beforeEach(() => {
    mailQueueService = {
      queueEmail: jest.fn().mockResolvedValue('task-name'),
    };
    service = new AuthenticationAccountStatusService(
      mailQueueService as unknown as ConstructorParameters<
        typeof AuthenticationAccountStatusService
      >[0],
    );
  });

  it('does nothing when user is not blocked', async () => {
    await expect(
      service.throwIfBlocked({
        id: 'user-id',
        status: UserStatus.active,
        accountUnlockCodeHash: null,
      }),
    ).resolves.toBeUndefined();

    expect(mailQueueService.queueEmail).not.toHaveBeenCalled();
  });

  it('queues unlock email and throws login retries response when user is blocked without unlock code', async () => {
    await expectLoginRetriesLimitReached(
      service.throwIfBlocked({
        id: 'user-id',
        status: UserStatus.blocked,
        accountUnlockCodeHash: null,
      }),
    );

    expect(mailQueueService.queueEmail).toHaveBeenCalledWith({
      userId: 'user-id',
      type: AuthenticationMailType.ACCOUNT_UNLOCK,
    });
  });

  it('throws login retries response without queueing email when unlock code exists', async () => {
    await expectLoginRetriesLimitReached(
      service.throwIfBlocked({
        id: 'user-id',
        status: UserStatus.blocked,
        accountUnlockCodeHash: 'unlock-code-hash',
      }),
    );

    expect(mailQueueService.queueEmail).not.toHaveBeenCalled();
  });
});

async function expectLoginRetriesLimitReached(
  promise: Promise<unknown>,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
  await expect(promise).rejects.toMatchObject({
    response: {
      success: false,
      error: {
        code: AUTH_ERROR_CODES.loginRetriesLimitReached,
        message: 'Login retries limit reached.',
        details: null,
      },
    },
  });
}
