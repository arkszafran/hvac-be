import { UserStatus } from '@generated/prisma/enums';

import { AuthenticationMailType } from '../mails/authentication-mail-type.enum';
import { RequestPasswordResetCommand } from './request-password-reset.command';

jest.mock('../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('RequestPasswordResetCommand', () => {
  const now = new Date('2026-07-06T10:00:00.000Z');
  const nextRequestAvailableAt = new Date('2026-07-06T10:15:00.000Z');

  let prisma: {
    user: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let mailQueueService: {
    queueEmail: jest.Mock;
  };
  let accountStatusService: {
    throwIfBlocked: jest.Mock;
  };
  let configService: {
    getOrThrow: jest.Mock;
  };
  let command: RequestPasswordResetCommand;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    prisma = {
      user: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mailQueueService = {
      queueEmail: jest.fn().mockResolvedValue('task-name'),
    };
    accountStatusService = {
      throwIfBlocked: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      getOrThrow: jest.fn().mockReturnValue('15'),
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
      configService as unknown as ConstructorParameters<
        typeof RequestPasswordResetCommand
      >[3],
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns success without queueing email when user does not exist', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      command.execute({ email: 'missing@example.com' }),
    ).resolves.toEqual({ success: true, data: null });

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
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
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'user-id',
        OR: [
          { passwordResetRequestAvailableAt: null },
          { passwordResetRequestAvailableAt: { lte: now } },
        ],
      },
      data: {
        passwordResetRequestAvailableAt: nextRequestAvailableAt,
      },
    });
    expect(mailQueueService.queueEmail).toHaveBeenCalledWith({
      userId: 'user-id',
      type: AuthenticationMailType.PASSWORD_RESET,
    });
  });

  it('does not queue password reset email when request cooldown is active', async () => {
    const user = {
      id: 'user-id',
      status: UserStatus.active,
      accountUnlockCodeHash: null,
    };
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      command.execute({ email: 'user@example.com' }),
    ).resolves.toEqual({ success: true, data: null });

    expect(accountStatusService.throwIfBlocked).toHaveBeenCalledWith(user);
    expect(mailQueueService.queueEmail).not.toHaveBeenCalled();
  });
});
