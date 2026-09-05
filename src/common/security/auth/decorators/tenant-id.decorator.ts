import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth.types';

export const TenantId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.tenantId) {
      throw new Error(
        'TenantId decorator requires TenantGuard to run before the controller action.',
      );
    }

    return request.tenantId;
  },
);
