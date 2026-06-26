import type { Request } from 'express';
import type {
  UserRole,
  UserStatus,
  UserTenantRole,
} from '@generated/prisma/enums';

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

export type AuthenticatedTenant = {
  id: string;
  role: UserTenantRole;
};

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
  status: UserStatus;
  tenants: AuthenticatedTenant[];
};

export type AuthenticatedRequest = RequestWithCookies & {
  user?: AuthenticatedUser;
  tenantId?: string;
};
