import type { Request } from 'express';
import type { UserRole, UserTenantRole } from '@generated/prisma/enums';

export type RequestWithCookies = Request & {
  cookies?: Record<string, string | undefined>;
};

export type AccessTokenPayload = {
  userId: string;
  role: UserRole;
  tenants: Array<{
    id: string;
    role: UserTenantRole;
  }>;
};

export type AuthUserWithTenants = {
  id: string;
  role: UserRole;
  tenants: Array<{
    tenantId: string;
    role: UserTenantRole;
  }>;
};
