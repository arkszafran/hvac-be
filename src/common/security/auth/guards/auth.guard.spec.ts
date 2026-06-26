import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus, UserTenantRole } from '@generated/prisma/enums';

import { AUTH_COOKIE_NAMES } from '../auth.constants';
import type { AuthenticatedRequest } from '../auth.types';
import { ALLOW_NEW_USER_KEY } from '../decorators/allow-new-user.decorator';
import { AuthGuard } from './auth.guard';

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AuthGuard', () => {
  let jwtService: {
    verifyAsync: jest.Mock;
  };
  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
  };
  let reflector: {
    getAllAndOverride: jest.Mock;
  };
  let guard: AuthGuard;

  beforeEach(() => {
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
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };

    guard = new AuthGuard(
      { getOrThrow: jest.fn().mockReturnValue('secret') } as never,
      jwtService as never,
      prisma as never,
      reflector as never,
    );
  });

  it('throws unauthorized when access token cookie is missing', async () => {
    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('does not read bearer token from authorization header', async () => {
    await expect(
      guard.canActivate(
        createContext({
          cookies: {},
          headers: { authorization: 'Bearer token' },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('adds current authenticated user to request', async () => {
    const request = createRequest('token');

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token', {
      secret: 'secret',
    });
    expect(request.user).toEqual({
      id: 'user-id',
      role: UserRole.TENANT_USER,
      status: UserStatus.active,
      tenants: [{ id: 'tenant-id', role: UserTenantRole.ADMIN }],
    });
  });

  it('throws forbidden when user is blocked', async () => {
    prisma.user.findUnique.mockResolvedValue(
      createDbUser({ status: UserStatus.blocked }),
    );

    await expect(
      guard.canActivate(createContext(createRequest('token'))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws forbidden for new user by default', async () => {
    prisma.user.findUnique.mockResolvedValue(
      createDbUser({ status: UserStatus.new }),
    );

    await expect(
      guard.canActivate(createContext(createRequest('token'))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows new user when action has allow new user metadata', async () => {
    prisma.user.findUnique.mockResolvedValue(
      createDbUser({ status: UserStatus.new }),
    );
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ALLOW_NEW_USER_KEY ? true : false,
    );

    await expect(
      guard.canActivate(createContext(createRequest('token'))),
    ).resolves.toBe(true);
  });
});

type TestDbUser = {
  id: string;
  role: UserRole;
  status: UserStatus;
  tenants: Array<{
    tenantId: string;
    role: UserTenantRole;
  }>;
};

type TestRequest = Pick<AuthenticatedRequest, 'cookies' | 'headers' | 'user'>;

function createDbUser(overrides: Partial<TestDbUser> = {}): TestDbUser {
  return {
    id: 'user-id',
    role: UserRole.TENANT_USER,
    status: UserStatus.active,
    tenants: [{ tenantId: 'tenant-id', role: UserTenantRole.ADMIN }],
    ...overrides,
  };
}

function createRequest(token?: string): TestRequest {
  return {
    cookies: token ? { [AUTH_COOKIE_NAMES.accessToken]: token } : {},
    headers: {},
  };
}

function createContext(request: TestRequest = createRequest()) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as Parameters<AuthGuard['canActivate']>[0];
}
