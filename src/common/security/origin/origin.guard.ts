import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { SKIP_ORIGIN_CHECK_KEY } from './origin.constants';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skipOriginCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_ORIGIN_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipOriginCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (!MUTATING_METHODS.has(request.method)) {
      return true;
    }

    const origin = request.headers.origin;

    if (typeof origin !== 'string' || !this.getAllowedOrigins().has(origin)) {
      throw new ForbiddenException('Request origin is not allowed.');
    }

    return true;
  }

  private getAllowedOrigins(): Set<string> {
    const allowedBrowserOrigins = this.configService.getOrThrow<string>(
      'ALLOWED_BROWSER_ORIGINS',
    );

    return new Set(
      allowedBrowserOrigins
        .split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean),
    );
  }
}
