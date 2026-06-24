import { Injectable } from '@nestjs/common';
import type { Response } from 'express';

import { apiSuccess } from '../../../common/types/api-response.type';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AUTH_COOKIE_NAMES } from '../authentication.constants';
import { AuthenticationTokenService } from '../authentication-token.service';
import type { RequestWithCookies } from '../authentication.types';

@Injectable()
export class LogoutCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: AuthenticationTokenService,
  ) {}

  async execute(request: RequestWithCookies, response: Response) {
    const userId = this.tokenService.getCookie(
      request,
      AUTH_COOKIE_NAMES.userId,
    );

    if (userId) {
      await this.prisma.user.updateMany({
        where: { id: userId },
        data: {
          refreshTokenHash: null,
          refreshTokenValidTo: null,
          sessionUnlockedUntil: null,
        },
      });
    }

    this.tokenService.clearAuthCookies(response);

    return apiSuccess();
  }
}
