import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus, UserTenantRole } from '@generated/prisma/enums';

import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import {
  AUTH_COOKIE_NAMES,
  AUTH_ERROR_CODES,
} from '../../authentication.constants';
import { AuthenticationAccountStatusService } from '../../authentication-account-status.service';
import { AuthenticationSessionService } from '../../authentication-session.service';
import { AuthenticationTokenService } from '../../authentication-token.service';
import type {
  AccessTokenPayload,
  RequestWithCookies,
} from '../../authentication.types';
import { GetSessionQuery } from '../impl/get-session.query';

type SessionUser = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly tenants: SessionTenant[];
};

type SessionTenant = {
  readonly id: string;
  readonly name: string;
  readonly role: UserTenantRole;
};

type DbSessionUser = SessionUser & {
  readonly accountUnlockCodeHash: string | null;
};

@QueryHandler(GetSessionQuery)
export class GetSessionHandler implements IQueryHandler<
  GetSessionQuery,
  ApiSuccessResponse<SessionUser>
> {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly sessionService: AuthenticationSessionService,
    private readonly tokenService: AuthenticationTokenService,
    private readonly accountStatusService: AuthenticationAccountStatusService,
  ) {}

  async execute(
    query: GetSessionQuery,
  ): Promise<ApiSuccessResponse<SessionUser>> {
    const accessToken = this.tokenService.getCookie(
      query.request,
      AUTH_COOKIE_NAMES.accessToken,
    );

    if (!accessToken) {
      return this.throwPinRequiredOrUnauthorized(query.request);
    }

    const payload = await this.verifyAccessToken(accessToken);

    if (!payload) {
      return this.throwPinRequiredOrUnauthorized(query.request);
    }

    const user = await this.getSessionUser(payload.userId);

    if (!user) {
      throwLoginRequiredException();
    }

    await this.accountStatusService.throwIfBlocked(user);

    return apiSuccess({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      tenants: user.tenants,
    });
  }

  private async throwPinRequiredOrUnauthorized(
    request: RequestWithCookies,
  ): Promise<never> {
    const user =
      await this.sessionService.getUserWithValidRefreshToken(request);

    await this.accountStatusService.throwIfBlocked(user);

    throw new HttpException(
      apiError({
        code: AUTH_ERROR_CODES.pinRequired,
        message: 'PIN login is required.',
        details: {
          redirectTo: this.tokenService.getFrontendRedirect('/pin-login'),
        },
      }),
      HttpStatus.LOCKED,
    );
  }

  private async verifyAccessToken(
    token: string,
  ): Promise<AccessTokenPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<
        Record<string, unknown>
      >(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      if (!this.isAccessTokenPayload(payload)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private async getSessionUser(userId: string): Promise<DbSessionUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        accountUnlockCodeHash: true,
        tenants: {
          select: {
            tenantId: true,
            role: true,
            tenant: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      accountUnlockCodeHash: user.accountUnlockCodeHash,
      tenants: user.tenants.map((tenant) => ({
        id: tenant.tenantId,
        name: tenant.tenant.name,
        role: tenant.role,
      })),
    };
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

function throwLoginRequiredException(): never {
  throw new UnauthorizedException(
    apiError({
      code: AUTH_ERROR_CODES.loginRequired,
      message: 'Login is required.',
    }),
  );
}
