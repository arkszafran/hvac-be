import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { apiError } from '../../../types/api-response.type';
import { AUTH_GUARD_ERROR_CODES } from '../auth.constants';
import type { AuthenticatedRequest } from '../auth.types';

const TENANT_ID_HEADER = 'x-tenant-id';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = this.getTenantId(request);

    if (!tenantId) {
      throw new ForbiddenException(
        apiError({
          code: AUTH_GUARD_ERROR_CODES.tenantIdMissing,
          message: 'Tenant id header is missing.',
        }),
      );
    }

    const hasTenantAccess =
      request.user?.tenants.some((tenant) => tenant.id === tenantId) ?? false;

    if (!hasTenantAccess) {
      throw new ForbiddenException(
        apiError({
          code: AUTH_GUARD_ERROR_CODES.tenantAccessDenied,
          message: 'User does not have access to tenant.',
        }),
      );
    }

    request.tenantId = tenantId;

    return true;
  }

  private getTenantId(request: AuthenticatedRequest): string | undefined {
    const header = request.headers[TENANT_ID_HEADER];

    if (Array.isArray(header)) {
      return header[0]?.trim() || undefined;
    }

    return header?.trim() || undefined;
  }
}
