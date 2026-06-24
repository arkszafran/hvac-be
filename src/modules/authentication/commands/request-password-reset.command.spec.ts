import { UserStatus } from '@generated/prisma/enums';

import { AuthenticationMailType } from '../mails/authentication-mail-type.enum';
import { RequestPasswordResetCommand } from './request-password-reset.command';

jest.mock('../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('RequestPasswordResetCommand', () => {
  let prisma: {
    user: {
      findFirst: jest.Mock;
    };
  };
  let mailQueueService: {
    queueEmail: jest.Mock;
  };
  let accountStatusService: {
    throwIfBlocked: jest.Mock;
  };
  let command: RequestPasswordResetCommand;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
      },
    };
    mailQueueService = {
      queueEmail: jest.fn().mockResolvedValue('task-name'),
    };
    accountStatusService = {
      throwIfBlocked: jest.fn().mockResolvedValue(undefined),
    };
    command = new RequestPasswordResetCommand(
      prisma as unknown as ConstructorParameters<
        typeof RequestPasswordResetCommand
      >[0],
      mailQueueService as unknown as ConstructorParameters<
        typeof RequestPasswordResetCommand
      >[1],
      accountStatusService as unknown as ConstructorParameters<
        typeof RequestPasswordResetCommand
      >[2],
    );
  });

  it('returns success without queueing email when user does not exist', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      command.execute({ email: 'missing@example.com' }),
    ).resolves.toEqual({ success: true, data: null });

    expect(mailQueueService.queueEmail).not.toHaveBeenCalled();
  });

  it('queues password reset email when user exists', async () => {
    const user = {
      id: 'user-id',
      status: UserStatus.active,
      accountUnlockCodeHash: null,
    };
    prisma.user.findFirst.mockResolvedValue(user);

    await expect(
      command.execute({ email: 'user@example.com' }),
    ).resolves.toEqual({ success: true, data: null });

    expect(accountStatusService.throwIfBlocked).toHaveBeenCalledWith(user);
    expect(mailQueueService.queueEmail).toHaveBeenCalledWith({
      userId: 'user-id',
      type: AuthenticationMailType.PASSWORD_RESET,
    });
  });
});
