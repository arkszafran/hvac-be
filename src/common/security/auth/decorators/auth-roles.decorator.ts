import { SetMetadata } from '@nestjs/common';
import type { UserRole, UserTenantRole } from '@generated/prisma/enums';

export const AUTH_ROLES_KEY = 'auth:roles';

export type AuthRoleRequirement = {
  readonly userRole?: UserRole | UserRole[];
  readonly tenantRole?: UserTenantRole | UserTenantRole[];
};

export const AuthRoles = (requirement: AuthRoleRequirement) =>
  SetMetadata(AUTH_ROLES_KEY, requirement);
