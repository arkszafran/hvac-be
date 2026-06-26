import { ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus, UserTenantRole } from '@generated/prisma/enums';

import type { AuthenticatedUser } from '../auth.types';
import { TenantGuard } from './tenant.guard';

describe('TenantGuard', () => {
  const guard = new TenantGuard();

  it('throws forbidden when tenant header is missing', () => {
    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });

  it('throws forbidden when authenticated user does not belong to tenant', () => {
    expect(() =>
      guard.canActivate(createContext({ headers: { 'x-tenant-id': 'other' } })),
    ).toThrow(ForbiddenException);
  });

  it('adds tenant id to request when user belongs to tenant', () => {
    const request = createRequest({ headers: { 'x-tenant-id': 'tenant-id' } });

    expect(guard.canActivate(createContext(request))).toBe(true);
    expect(request.tenantId).toBe('tenant-id');
  });
});

type TestRequest = {
  headers: Record<string, string | string[] | undefined>;
  user: AuthenticatedUser;
  tenantId?: string;
};

function createRequest(overrides: Partial<TestRequest> = {}): TestRequest {
  return {
    headers: {},
    user: {
      id: 'user-id',
      role: UserRole.TENANT_USER,
      status: UserStatus.active,
      tenants: [{ id: 'tenant-id', role: UserTenantRole.USER }],
    },
    ...overrides,
  };
}

function createContext(request: TestRequest = createRequest()) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as Parameters<TenantGuard['canActivate']>[0];
}
