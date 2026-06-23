import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@generated/prisma/enums';
import type { Response } from 'express';

import { verifyPassword } from '../../../common/security/password/password';
import { AUTH_REDIRECT_REASONS } from '../authentication.constants';
import type { RequestWithCookies } from '../authentication.types';
import { PinLoginCommand } from './pin-login.command';

jest.mock('../../../common/security/password/password', () => ({
  verifyPassword: jest.fn(),
}));
jest.mock('../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

const verifyPasswordMock = jest.mocked(verifyPassword);

describe('PinLoginCommand', () => {
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
    getPinRetriesNumber: jest.Mock;
    createRefreshToken: jest.Mock;
    hashToken: jest.Mock;
    getRefreshTokenValidTo: jest.Mock;
    createAccessToken: jest.Mock;
    setAuthCookies: jest.Mock;
    clearAuthCookies: jest.Mock;
    getFrontendRedirect: jest.Mock;
  };
  let request: RequestWithCookies;
  let response: Response & { status: jest.Mock };
  let command: PinLoginCommand;

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
      getPinRetriesNumber: jest.fn().mockReturnValue(3),
      createRefreshToken: jest.fn().mockReturnValue('new-refresh-token'),
      hashToken: jest.fn().mockResolvedValue('new-refresh-token-hash'),
      getRefreshTokenValidTo: jest.fn().mockReturnValue(refreshTokenValidTo),
      createAccessToken: jest.fn().mockResolvedValue('new-access-token'),
      setAuthCookies: jest.fn(),
      clearAuthCookies: jest.fn(),
      getFrontendRedirect: jest.fn().mockReturnValue('/login'),
    };
    request = { cookies: {} } as RequestWithCookies;
    response = {
      status: jest.fn().mockReturnThis(),
    } as unknown as Response & { status: jest.Mock };
    command = new PinLoginCommand(
      prisma as unknown as ConstructorParameters<typeof PinLoginCommand>[0],
      sessionService as unknown as ConstructorParameters<
        typeof PinLoginCommand
      >[1],
      tokenService as unknown as ConstructorParameters<
        typeof PinLoginCommand
      >[2],
    );

    verifyPasswordMock.mockReset();
  });

  it('throws unauthorized without verifying PIN when retry limit is already reached', async () => {
    const user = createUser({ incorrectPINCounter: 3 });
    sessionService.getUserWithValidRefreshToken.mockResolvedValue(user);

    await expect(
      command.execute({ pin: '1234' }, request, response),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('increments PIN counter and throws unauthorized when PIN is invalid below limit', async () => {
    const user = createUser({ incorrectPINCounter: 1 });
    sessionService.getUserWithValidRefreshToken.mockResolvedValue(user);
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      command.execute({ pin: '9999' }, request, response),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        incorrectPINCounter: 2,
      },
    });
  });

  it('clears refresh token and returns login redirect when invalid PIN reaches limit', async () => {
    const user = createUser({ incorrectPINCounter: 2 });
    sessionService.getUserWithValidRefreshToken.mockResolvedValue(user);
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      command.execute({ pin: '9999' }, request, response),
    ).resolves.toEqual({
      reason: AUTH_REDIRECT_REASONS.loginRequired,
      redirectTo: '/login',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        incorrectPINCounter: 3,
        refreshTokenHash: null,
        refreshTokenValidTo: null,
      },
    });
    expect(response.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(tokenService.clearAuthCookies).toHaveBeenCalledWith(response);
  });

  it('rotates refresh token, resets PIN counter and sets cookies when PIN is valid', async () => {
    const user = createUser({ incorrectPINCounter: 1 });
    sessionService.getUserWithValidRefreshToken.mockResolvedValue(user);
    verifyPasswordMock.mockResolvedValue(true);

    await expect(
      command.execute({ pin: '1234' }, request, response),
    ).resolves.toEqual({ success: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        incorrectPINCounter: 0,
        refreshTokenHash: 'new-refresh-token-hash',
        refreshTokenValidTo,
      },
    });
    expect(tokenService.createAccessToken).toHaveBeenCalledWith(user);
    expect(tokenService.setAuthCookies).toHaveBeenCalledWith({
      response,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      userId: user.id,
    });
  });
});

function createUser(
  overrides: Partial<{
    incorrectPINCounter: number;
    pin: string | null;
  }> = {},
) {
  return {
    id: 'user-id',
    role: UserRole.ADMIN,
    tenants: [],
    pin: overrides.pin ?? 'pin-hash',
    incorrectPINCounter: overrides.incorrectPINCounter ?? 0,
  };
}

function futureDate(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}
