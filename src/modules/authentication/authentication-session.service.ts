import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUTH_COOKIE_NAMES } from './authentication.constants';
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
      throw new UnauthorizedException('Refresh token is missing.');
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
      throw new UnauthorizedException('Refresh token is invalid.');
    }

    const isRefreshTokenValid = await this.tokenService.verifyToken(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Refresh token is invalid.');
    }

    return user;
  }
}
