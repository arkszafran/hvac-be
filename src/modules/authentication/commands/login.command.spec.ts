import { UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@generated/prisma/enums';
import type { Response } from 'express';

import { verifyPassword } from '../../../common/security/password/password';
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
    response = {} as Response;
    command = new LoginCommand(
      prisma as unknown as ConstructorParameters<typeof LoginCommand>[0],
      tokenService as unknown as ConstructorParameters<typeof LoginCommand>[1],
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
  });

  it('blocks user without checking password when login retry limit is already reached', async () => {
    const user = createUser({ incorrectLoginCounter: 3 });
    prisma.user.findFirst.mockResolvedValue(user);

    await expect(
      command.execute({ email: user.email, password: 'secret' }, response),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        status: UserStatus.blocked,
      },
    });
  });

  it('does not update blocked user before throwing unauthorized', async () => {
    const user = createUser({
      status: UserStatus.blocked,
      incorrectLoginCounter: 3,
    });
    prisma.user.findFirst.mockResolvedValue(user);

    await expect(
      command.execute({ email: user.email, password: 'secret' }, response),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('increments failed login counter and blocks user when limit is reached', async () => {
    const user = createUser({ incorrectLoginCounter: 2 });
    prisma.user.findFirst.mockResolvedValue(user);
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      command.execute({ email: user.email, password: 'wrong' }, response),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        incorrectLoginCounter: 3,
        status: UserStatus.blocked,
      },
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
    ).resolves.toEqual({ success: true });

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
    tenants: [],
  };
}

function futureDate(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}
