import type { Response } from 'express';

import { AUTH_COOKIE_NAMES } from '../authentication.constants';
import type { RequestWithCookies } from '../authentication.types';
import { LogoutCommand } from './logout.command';

jest.mock('../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('LogoutCommand', () => {
  let prisma: {
    user: {
      updateMany: jest.Mock;
    };
  };
  let tokenService: {
    getCookie: jest.Mock;
    clearAuthCookies: jest.Mock;
  };
  let request: RequestWithCookies;
  let response: Response;
  let command: LogoutCommand;

  beforeEach(() => {
    prisma = {
      user: {
        updateMany: jest.fn(),
      },
    };
    tokenService = {
      getCookie: jest.fn(),
      clearAuthCookies: jest.fn(),
    };
    request = { cookies: {} } as RequestWithCookies;
    response = {} as Response;
    command = new LogoutCommand(
      prisma as unknown as ConstructorParameters<typeof LogoutCommand>[0],
      tokenService as unknown as ConstructorParameters<typeof LogoutCommand>[1],
    );
  });

  it('clears stored session data and auth cookies when userId cookie exists', async () => {
    tokenService.getCookie.mockReturnValue('user-id');

    await expect(command.execute(request, response)).resolves.toEqual({
      success: true,
    });

    expect(tokenService.getCookie).toHaveBeenCalledWith(
      request,
      AUTH_COOKIE_NAMES.userId,
    );
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: {
        refreshTokenHash: null,
        refreshTokenValidTo: null,
        sessionUnlockedUntil: null,
      },
    });
    expect(tokenService.clearAuthCookies).toHaveBeenCalledWith(response);
  });

  it('clears cookies without touching database when userId cookie is missing', async () => {
    tokenService.getCookie.mockReturnValue(undefined);

    await expect(command.execute(request, response)).resolves.toEqual({
      success: true,
    });

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(tokenService.clearAuthCookies).toHaveBeenCalledWith(response);
  });
});
