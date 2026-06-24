import { HttpStatus, Injectable } from '@nestjs/common';
import type { Response } from 'express';

import { apiError, apiSuccess } from '../../../common/types/api-response.type';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  AUTH_COOKIE_NAMES,
  AUTH_ERROR_CODES,
} from '../authentication.constants';
import { AuthenticationSessionService } from '../authentication-session.service';
import { AuthenticationTokenService } from '../authentication-token.service';
import type { RequestWithCookies } from '../authentication.types';

@Injectable()
export class RefreshCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: AuthenticationSessionService,
    private readonly tokenService: AuthenticationTokenService,
  ) {}

  async execute(request: RequestWithCookies, response: Response) {
    const user =
      await this.sessionService.getUserWithValidRefreshToken(request);

    if (!user.sessionUnlockedUntil || user.sessionUnlockedUntil <= new Date()) {
      response.status(HttpStatus.LOCKED);

      return apiError({
        code: AUTH_ERROR_CODES.pinRequired,
        message: 'PIN login is required.',
        details: {
          redirectTo: this.tokenService.getFrontendRedirect('/pin-login'),
        },
      });
    }

    const refreshToken = this.tokenService.createRefreshToken();
    const refreshTokenHash = await this.tokenService.hashToken(refreshToken);
    const refreshTokenValidTo = this.tokenService.getRefreshTokenValidTo();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash,
        refreshTokenValidTo,
      },
    });

    const accessToken = await this.tokenService.createAccessToken(user);

    this.tokenService.setAccessTokenCookie(response, accessToken);
    this.tokenService.setRefreshTokenCookie(response, refreshToken);
    this.tokenService.setUserIdCookie(
      response,
      this.tokenService.getCookie(request, AUTH_COOKIE_NAMES.userId) ?? user.id,
    );

    return apiSuccess();
  }
}
