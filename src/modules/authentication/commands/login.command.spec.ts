import { UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@generated/prisma/enums';
import type { Response } from 'express';

import { verifyPassword } from '../../../common/security/password/password';
import { AUTH_ERROR_CODES } from '../authentication.constants';
import { AuthenticationMailType } from '../mails/authentication-mail-type.enum';
import { LoginCommand } from './login.command';

jest.mock('../../../common/security/password/password', () => ({
  verifyPassword: jest.fn(),
}));
jest.mock('../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

const verifyPasswordMock = jest.mocked(verifyPassword);

describe('LoginCommand', () => {
  const refreshTokenValidTo = futureDate();
  const sessionUnlockedUntil = futureDate();

  let prisma: {
    user: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let tokenService: {
    getLoginRetriesNumber: jest.Mock;
    createRefreshToken: jest.Mock;
    hashToken: jest.Mock;
    getRefreshTokenValidTo: jest.Mock;
    getSessionUnlockedUntil: jest.Mock;
    createAccessToken: jest.Mock;
    setAuthCookies: jest.Mock;
  };
  let mailQueueService: {
    queueEmail: jest.Mock;
  };
  let response: Response;
  let command: LoginCommand;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    tokenService = {
      getLoginRetriesNumber: jest.fn().mockReturnValue(3),
      createRefreshToken: jest.fn().mockReturnValue('refresh-token'),
      hashToken: jest.fn().mockResolvedValue('refresh-token-hash'),
      getRefreshTokenValidTo: jest.fn().mockReturnValue(refreshTokenValidTo),
      getSessionUnlockedUntil: jest.fn().mockReturnValue(sessionUnlockedUntil),
      createAccessToken: jest.fn().mockResolvedValue('access-token'),
      setAuthCookies: jest.fn(),
    };
    mailQueueService = {
      queueEmail: jest.fn().mockResolvedValue('task-name'),
    };
    response = {} as Response;
    command = new LoginCommand(
      prisma as unknown as ConstructorParameters<typeof LoginCommand>[0],
      tokenService as unknown as ConstructorParameters<typeof LoginCommand>[1],
      mailQueueService as unknown as ConstructorParameters<
        typeof LoginCommand
      >[2],
    );

    verifyPasswordMock.mockReset();
  });

  it('throws unauthorized when user does not exist', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      command.execute(
        { email: 'user@example.com', password: 'secret' },
        response,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(mailQueueService.queueEmail).not.toHaveBeenCalled();
  });

  it('queues unlock email for blocked user without unlock code before throwing unauthorized', async () => {
    const user = createUser({
      status: UserStatus.blocked,
      incorrectLoginCounter: 3,
      accountUnlockCodeHash: null,
    });
    prisma.user.findFirst.mockResolvedValue(user);

    await expectLoginRetriesLimitReached(
      command.execute({ email: user.email, password: 'secret' }, response),
    );

    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(mailQueueService.queueEmail).toHaveBeenCalledWith({
      userId: user.id,
      type: AuthenticationMailType.ACCOUNT_UNLOCK,
    });
  });

  it('does not queue unlock email for blocked user with existing unlock code', async () => {
    const user = createUser({
      status: UserStatus.blocked,
      incorrectLoginCounter: 3,
      accountUnlockCodeHash: 'unlock-code-hash',
    });
    prisma.user.findFirst.mockResolvedValue(user);

    await expectLoginRetriesLimitReached(
      command.execute({ email: user.email, password: 'secret' }, response),
    );

    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(mailQueueService.queueEmail).not.toHaveBeenCalled();
  });

  it('increments failed login counter and blocks user when limit is reached', async () => {
    const user = createUser({ incorrectLoginCounter: 2 });
    prisma.user.findFirst.mockResolvedValue(user);
    verifyPasswordMock.mockResolvedValue(false);

    await expectLoginRetriesLimitReached(
      command.execute({ email: user.email, password: 'wrong' }, response),
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        incorrectLoginCounter: 3,
        status: UserStatus.blocked,
      },
    });
    expect(mailQueueService.queueEmail).toHaveBeenCalledWith({
      userId: user.id,
      type: AuthenticationMailType.ACCOUNT_UNLOCK,
    });
  });

  it('creates tokens, stores refresh hash, resets counters and sets cookies on successful login', async () => {
    const user = createUser({
      incorrectLoginCounter: 1,
      incorrectPINCounter: 2,
    });
    prisma.user.findFirst.mockResolvedValue(user);
    verifyPasswordMock.mockResolvedValue(true);

    await expect(
      command.execute({ email: user.email, password: 'secret' }, response),
    ).resolves.toEqual({ success: true, data: null });

    expect(tokenService.createRefreshToken).toHaveBeenCalled();
    expect(tokenService.hashToken).toHaveBeenCalledWith('refresh-token');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        sessionUnlockedUntil,
        incorrectLoginCounter: 0,
        incorrectPINCounter: 0,
        refreshTokenHash: 'refresh-token-hash',
        refreshTokenValidTo,
      },
    });
    expect(tokenService.createAccessToken).toHaveBeenCalledWith(user);
    expect(tokenService.setAuthCookies).toHaveBeenCalledWith({
      response,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      userId: user.id,
    });
    expect(mailQueueService.queueEmail).not.toHaveBeenCalled();
  });
});

function createUser(
  overrides: Partial<{
    id: string;
    email: string;
    password: string;
    status: UserStatus;
    incorrectLoginCounter: number;
    incorrectPINCounter: number;
    accountUnlockCodeHash: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 'user-id',
    email: overrides.email ?? 'user@example.com',
    password: overrides.password ?? 'password-hash',
    role: UserRole.ADMIN,
    status: overrides.status ?? UserStatus.active,
    incorrectLoginCounter: overrides.incorrectLoginCounter ?? 0,
    incorrectPINCounter: overrides.incorrectPINCounter ?? 0,
    accountUnlockCodeHash: overrides.accountUnlockCodeHash ?? null,
    tenants: [],
  };
}

function futureDate(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

async function expectLoginRetriesLimitReached(
  promise: Promise<unknown>,
): Promise<void> {
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
