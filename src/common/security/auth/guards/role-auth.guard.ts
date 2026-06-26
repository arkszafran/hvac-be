import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { apiError } from '../../../types/api-response.type';
import { AUTH_GUARD_ERROR_CODES } from '../auth.constants';
import type { AuthenticatedRequest } from '../auth.types';
import {
  AUTH_ROLES_KEY,
  type AuthRoleRequirement,
} from '../decorators/auth-roles.decorator';

@Injectable()
export class RoleAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requirement = this.reflector.getAllAndOverride<AuthRoleRequirement>(
      AUTH_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throwAccessDenied();
    }

    if (
      requirement.userRole &&
      !toArray(requirement.userRole).includes(user.role)
    ) {
      throwAccessDenied();
    }

    if (!requirement.tenantRole) {
      return true;
    }

    if (!request.tenantId) {
      throwAccessDenied();
    }

    const tenant = user.tenants.find(
      (userTenant) => userTenant.id === request.tenantId,
    );

    if (!tenant || !toArray(requirement.tenantRole).includes(tenant.role)) {
      throwAccessDenied();
    }

    return true;
  }
}

function toArray<TValue>(value: TValue | TValue[]): TValue[] {
  return Array.isArray(value) ? value : [value];
}

function throwAccessDenied(): never {
  throw new ForbiddenException(
    apiError({
      code: AUTH_GUARD_ERROR_CODES.accessDenied,
      message: 'Access is denied.',
    }),
  );
}
