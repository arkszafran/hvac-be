import { HttpStatus } from '@nestjs/common';
import { UserRole, UserStatus } from '@generated/prisma/enums';
import type { Response } from 'express';

import { AUTH_ERROR_CODES } from '../authentication.constants';
import type { RequestWithCookies } from '../authentication.types';
import { RefreshCommand } from './refresh.command';

jest.mock('../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('RefreshCommand', () => {
  const refreshTokenValidTo = futureDate();

  let prisma: {
    user: {
      update: jest.Mock;
    };
  };
  let sessionService: {
    getUserWithValidRefreshToken: jest.Mock;
  };
  let tokenService: {
    createRefreshToken: jest.Mock;
    hashToken: jest.Mock;
    getRefreshTokenValidTo: jest.Mock;
    createAccessToken: jest.Mock;
    setAccessTokenCookie: jest.Mock;
    setRefreshTokenCookie: jest.Mock;
    setUserIdCookie: jest.Mock;
    getCookie: jest.Mock;
    getFrontendRedirect: jest.Mock;
  };
  let accountStatusService: {
    throwIfBlocked: jest.Mock;
  };
  let response: Response & { status: jest.Mock };
  let request: RequestWithCookies;
  let command: RefreshCommand;

  beforeEach(() => {
    prisma = {
      user: {
        update: jest.fn(),
      },
    };
    sessionService = {
      getUserWithValidRefreshToken: jest.fn(),
    };
    tokenService = {
      createRefreshToken: jest.fn().mockReturnValue('new-refresh-token'),
      hashToken: jest.fn().mockResolvedValue('new-refresh-token-hash'),
      getRefreshTokenValidTo: jest.fn().mockReturnValue(refreshTokenValidTo),
      createAccessToken: jest.fn().mockResolvedValue('new-access-token'),
      setAccessTokenCookie: jest.fn(),
      setRefreshTokenCookie: jest.fn(),
      setUserIdCookie: jest.fn(),
      getCookie: jest.fn().mockReturnValue('cookie-user-id'),
      getFrontendRedirect: jest.fn().mockReturnValue('/pin-login'),
    };
    accountStatusService = {
      throwIfBlocked: jest.fn().mockResolvedValue(undefined),
    };
    response = {
      status: jest.fn().mockReturnThis(),
    } as unknown as Response & { status: jest.Mock };
    request = { cookies: {} } as RequestWithCookies;
    command = new RefreshCommand(
      prisma as unknown as ConstructorParameters<typeof RefreshCommand>[0],
      sessionService as unknown as ConstructorParameters<
        typeof RefreshCommand
      >[1],
      tokenService as unknown as ConstructorParameters<
        typeof RefreshCommand
      >[2],
      accountStatusService as unknown as ConstructorParameters<
        typeof RefreshCommand
      >[3],
    );
  });

  it('returns pin redirect when session is locked', async () => {
    const user = createUser({ sessionUnlockedUntil: pastDate() });
    sessionService.getUserWithValidRefreshToken.mockResolvedValue(user);

    await expect(command.execute(request, response)).resolves.toEqual({
      success: false,
      error: {
        code: AUTH_ERROR_CODES.pinRequired,
        message: 'PIN login is required.',
        details: {
          redirectTo: '/pin-login',
        },
      },
    });

    expect(response.status).toHaveBeenCalledWith(HttpStatus.LOCKED);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(tokenService.createRefreshToken).not.toHaveBeenCalled();
  });

  it('rotates refresh token and creates a new access token when session is unlocked', async () => {
    const user = createUser({
      sessionUnlockedUntil: futureDate(),
    });
    sessionService.getUserWithValidRefreshToken.mockResolvedValue(user);

    await expect(command.execute(request, response)).resolves.toEqual({
      success: true,
      data: null,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        refreshTokenHash: 'new-refresh-token-hash',
        refreshTokenValidTo,
      },
    });
    expect(tokenService.createAccessToken).toHaveBeenCalledWith(user);
    expect(tokenService.setAccessTokenCookie).toHaveBeenCalledWith(
      response,
      'new-access-token',
    );
    expect(tokenService.setRefreshTokenCookie).toHaveBeenCalledWith(
      response,
      'new-refresh-token',
    );
    expect(tokenService.setUserIdCookie).toHaveBeenCalledWith(
      response,
      'cookie-user-id',
    );
  });
});

function createUser(overrides: Partial<{ sessionUnlockedUntil: Date | null }>) {
  return {
    id: 'user-id',
    role: UserRole.ADMIN,
    status: UserStatus.active,
    accountUnlockCodeHash: null,
    tenants: [],
    sessionUnlockedUntil: overrides.sessionUnlockedUntil ?? null,
  };
}

function futureDate(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

function pastDate(): Date {
  return new Date(Date.now() - 60 * 60 * 1000);
}
