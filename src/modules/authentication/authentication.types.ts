import type { UserRole, UserTenantRole } from '@generated/prisma/enums';

export type {
  AccessTokenPayload,
  RequestWithCookies,
} from '../../common/security/auth/auth.types';

export type AuthUserWithTenants = {
  id: string;
  role: UserRole;
  tenants: Array<{
    tenantId: string;
    role: UserTenantRole;
  }>;
};
