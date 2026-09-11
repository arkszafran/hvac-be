import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth.types';

export const UserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new Error(
        'UserId decorator requires AuthGuard to run before the controller action.',
      );
    }

    return request.user.id;
  },
);
