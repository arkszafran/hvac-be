import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole, UserStatus, UserTenantRole } from '@generated/prisma/enums';

import { apiError } from '../../../../common/types/api-response.type';
import {
  AUTH_COOKIE_NAMES,
  AUTH_ERROR_CODES,
} from '../../authentication.constants';
import type { RequestWithCookies } from '../../authentication.types';
import { GetSessionQuery } from '../impl/get-session.query';
import { GetSessionHandler } from './get-session.handler';

jest.mock('../../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('GetSessionHandler', () => {
  let configService: {
    getOrThrow: jest.Mock;
  };
  let jwtService: {
    verifyAsync: jest.Mock;
  };
  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
  };
  let sessionService: {
    getUserWithValidRefreshToken: jest.Mock;
  };
  let tokenService: {
    getCookie: jest.Mock;
    getFrontendRedirect: jest.Mock;
  };
  let accountStatusService: {
    throwIfBlocked: jest.Mock;
  };
  let request: RequestWithCookies;
  let handler: GetSessionHandler;

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn().mockReturnValue('secret'),
    };
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        userId: 'user-id',
        role: UserRole.TENANT_USER,
        tenants: [{ id: 'tenant-id', role: UserTenantRole.USER }],
      }),
    };
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(createDbUser()),
      },
    };
    sessionService = {
      getUserWithValidRefreshToken: jest
        .fn()
        .mockResolvedValue(createRefreshUser()),
    };
    tokenService = {
      getCookie: jest.fn((_: RequestWithCookies, name: string) =>
        name === AUTH_COOKIE_NAMES.accessToken ? 'access-token' : undefined,
      ),
      getFrontendRedirect: jest.fn().mockReturnValue('/pin-login'),
    };
    accountStatusService = {
      throwIfBlocked: jest.fn().mockResolvedValue(undefined),
    };
    request = { cookies: {} } as RequestWithCookies;
    handler = new GetSessionHandler(
      configService as never,
      jwtService as never,
      prisma as never,
      sessionService as never,
      tokenService as never,
      accountStatusService as never,
    );
  });

  it('returns basic session data when access token is valid', async () => {
    await expect(
      handler.execute(new GetSessionQuery(request)),
    ).resolves.toEqual({
      success: true,
      data: {
        id: 'user-id',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: UserRole.TENANT_USER,
        status: UserStatus.active,
        tenants: [
          {
            id: 'tenant-id',
            name: 'Acme HVAC',
            role: UserTenantRole.ADMIN,
          },
        ],
      },
    });

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
      secret: 'secret',
    });
    expect(sessionService.getUserWithValidRefreshToken).not.toHaveBeenCalled();
    expect(accountStatusService.throwIfBlocked).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-id' }),
    );
  });

  it('returns pin redirect error when access token is invalid and refresh token is valid', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

    await expectPinRequired(handler.execute(new GetSessionQuery(request)));

    expect(sessionService.getUserWithValidRefreshToken).toHaveBeenCalledWith(
      request,
    );
    expect(tokenService.getFrontendRedirect).toHaveBeenCalledWith('/pin-login');
  });

  it('returns pin redirect error when access token is missing and refresh token is valid', async () => {
    tokenService.getCookie.mockReturnValue(undefined);

    await expectPinRequired(handler.execute(new GetSessionQuery(request)));

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('returns unauthorized when refresh token is missing or invalid', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('expired'));
    sessionService.getUserWithValidRefreshToken.mockRejectedValue(
      new UnauthorizedException(
        apiError({
          code: AUTH_ERROR_CODES.refreshTokenMissing,
          message: 'Refresh token is missing.',
        }),
      ),
    );

    await expect(
      handler.execute(new GetSessionQuery(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns unauthorized when token user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new GetSessionQuery(request)),
    ).rejects.toMatchObject({
      response: {
        success: false,
        error: {
          code: AUTH_ERROR_CODES.loginRequired,
          message: 'Login is required.',
          details: null,
        },
      },
    });
  });
});

function createDbUser() {
  return {
    id: 'user-id',
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: UserRole.TENANT_USER,
    status: UserStatus.active,
    accountUnlockCodeHash: null,
    tenants: [
      {
        tenantId: 'tenant-id',
        role: UserTenantRole.ADMIN,
        tenant: {
          name: 'Acme HVAC',
        },
      },
    ],
  };
}

function createRefreshUser() {
  return {
    id: 'user-id',
    role: UserRole.TENANT_USER,
    status: UserStatus.active,
    accountUnlockCodeHash: null,
    tenants: [],
  };
}

async function expectPinRequired(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    status: HttpStatus.LOCKED,
    response: {
      success: false,
      error: {
        code: AUTH_ERROR_CODES.pinRequired,
        message: 'PIN login is required.',
        details: {
          redirectTo: '/pin-login',
        },
      },
    },
  } satisfies Partial<HttpException>);
}
