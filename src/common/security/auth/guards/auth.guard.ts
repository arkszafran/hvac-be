import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus, UserTenantRole } from '@generated/prisma/enums';

import { PrismaService } from '../../../prisma/prisma.service';
import { apiError } from '../../../types/api-response.type';
import { AUTH_COOKIE_NAMES, AUTH_GUARD_ERROR_CODES } from '../auth.constants';
import type {
  AccessTokenPayload,
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../auth.types';
import { ALLOW_NEW_USER_KEY } from '../decorators/allow-new-user.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.getAccessTokenFromCookie(request);

    if (!token) {
      throw new UnauthorizedException(
        apiError({
          code: AUTH_GUARD_ERROR_CODES.accessTokenMissing,
          message: 'Access token cookie is missing.',
        }),
      );
    }

    const payload = await this.verifyAccessToken(token);
    const user = await this.getAuthenticatedUser(payload.userId);

    if (!user) {
      throw new UnauthorizedException(
        apiError({
          code: AUTH_GUARD_ERROR_CODES.userNotFound,
          message: 'Authenticated user was not found.',
        }),
      );
    }

    if (user.status === UserStatus.blocked) {
      throw new ForbiddenException(
        apiError({
          code: AUTH_GUARD_ERROR_CODES.accountBlocked,
          message: 'Account is blocked.',
        }),
      );
    }

    if (user.status === UserStatus.new && !this.canNewUserAccess(context)) {
      throw new ForbiddenException(
        apiError({
          code: AUTH_GUARD_ERROR_CODES.accountSetupRequired,
          message: 'Account setup is required.',
        }),
      );
    }

    request.user = user;

    return true;
  }

  private getAccessTokenFromCookie(
    request: AuthenticatedRequest,
  ): string | undefined {
    const cookies = request.cookies as
      | Record<string, string | undefined>
      | undefined;

    return cookies?.[AUTH_COOKIE_NAMES.accessToken];
  }

  private async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<
        Record<string, unknown>
      >(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      if (!this.isAccessTokenPayload(payload)) {
        throw new UnauthorizedException();
      }

      return payload;
    } catch {
      throw new UnauthorizedException(
        apiError({
          code: AUTH_GUARD_ERROR_CODES.accessTokenInvalid,
          message: 'Access token is invalid.',
        }),
      );
    }
  }

  private async getAuthenticatedUser(
    userId: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        tenants: {
          select: {
            tenantId: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      role: user.role,
      status: user.status,
      tenants: user.tenants.map((tenant) => ({
        id: tenant.tenantId,
        role: tenant.role,
      })),
    };
  }

  private canNewUserAccess(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(ALLOW_NEW_USER_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  private isAccessTokenPayload(
    payload: unknown,
  ): payload is AccessTokenPayload {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const candidate = payload as Partial<AccessTokenPayload>;

    return (
      typeof candidate.userId === 'string' &&
      Object.values(UserRole).includes(candidate.role as UserRole) &&
      Array.isArray(candidate.tenants) &&
      candidate.tenants.every(
        (tenant) =>
          typeof tenant.id === 'string' &&
          Object.values(UserTenantRole).includes(tenant.role),
      )
    );
  }
}
