import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<Request>();
    const value = request.headers['idempotency-key'];

    return Array.isArray(value) ? value[0] : value;
  },
);
