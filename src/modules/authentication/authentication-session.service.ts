import { Injectable, UnauthorizedException } from '@nestjs/common';

import { apiError } from '../../common/types/api-response.type';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AUTH_COOKIE_NAMES,
  AUTH_ERROR_CODES,
} from './authentication.constants';
import { AuthenticationTokenService } from './authentication-token.service';
import type { RequestWithCookies } from './authentication.types';

@Injectable()
export class AuthenticationSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: AuthenticationTokenService,
  ) {}

  async getUserWithValidRefreshToken(request: RequestWithCookies) {
    const userId = this.tokenService.getCookie(
      request,
      AUTH_COOKIE_NAMES.userId,
    );
    const refreshToken = this.tokenService.getCookie(
      request,
      AUTH_COOKIE_NAMES.refreshToken,
    );

    if (!userId || !refreshToken) {
      throw new UnauthorizedException(
        apiError({
          code: AUTH_ERROR_CODES.refreshTokenMissing,
          message: 'Refresh token is missing.',
        }),
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenants: {
          select: {
            tenantId: true,
            role: true,
          },
        },
      },
    });

    if (
      !user?.refreshTokenHash ||
      !user.refreshTokenValidTo ||
      user.refreshTokenValidTo <= new Date()
    ) {
      throwInvalidRefreshTokenException();
    }

    const isRefreshTokenValid = await this.tokenService.verifyToken(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throwInvalidRefreshTokenException();
    }

    return user;
  }
}

function throwInvalidRefreshTokenException(): never {
  throw new UnauthorizedException(
    apiError({
      code: AUTH_ERROR_CODES.refreshTokenInvalid,
      message: 'Refresh token is invalid.',
    }),
  );
}
