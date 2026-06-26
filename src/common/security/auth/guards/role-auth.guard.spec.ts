import { ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus, UserTenantRole } from '@generated/prisma/enums';

import type { AuthenticatedUser } from '../auth.types';
import { AUTH_ROLES_KEY } from '../decorators/auth-roles.decorator';
import { RoleAuthGuard } from './role-auth.guard';

describe('RoleAuthGuard', () => {
  let reflector: {
    getAllAndOverride: jest.Mock;
  };
  let guard: RoleAuthGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    guard = new RoleAuthGuard(reflector as never);
  });

  it('allows request when role metadata is missing', () => {
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows global admin action for admin user', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === AUTH_ROLES_KEY ? { userRole: UserRole.ADMIN } : undefined,
    );

    expect(
      guard.canActivate(
        createContext(createRequest({ user: createUser(UserRole.ADMIN) })),
      ),
    ).toBe(true);
  });

  it('does not allow global admin to bypass tenant role requirement', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === AUTH_ROLES_KEY ? { tenantRole: UserTenantRole.USER } : undefined,
    );

    expect(() =>
      guard.canActivate(
        createContext(
          createRequest({
            tenantId: 'tenant-id',
            user: createUser(UserRole.ADMIN, []),
          }),
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows tenant action when user has matching tenant role', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === AUTH_ROLES_KEY
        ? { tenantRole: [UserTenantRole.USER, UserTenantRole.ADMIN] }
        : undefined,
    );

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('throws forbidden when tenant role does not match', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === AUTH_ROLES_KEY ? { tenantRole: UserTenantRole.ADMIN } : undefined,
    );

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });
});

type TestRequest = {
  tenantId: string;
  user: AuthenticatedUser;
};

function createUser(
  role: UserRole = UserRole.TENANT_USER,
  tenants: AuthenticatedUser['tenants'] = [
    { id: 'tenant-id', role: UserTenantRole.USER },
  ],
): AuthenticatedUser {
  return {
    id: 'user-id',
    role,
    status: UserStatus.active,
    tenants,
  };
}

function createRequest(overrides: Partial<TestRequest> = {}): TestRequest {
  return {
    tenantId: 'tenant-id',
    user: createUser(),
    ...overrides,
  };
}

function createContext(request: TestRequest = createRequest()) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as Parameters<RoleAuthGuard['canActivate']>[0];
}
