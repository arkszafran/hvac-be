import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';

import { PrismaService } from '../../common/prisma/prisma.service';
import { verifyPassword } from '../../common/security/password/password';
import { AUTH_REDIRECT_REASONS } from '../authentication.constants';
import { AuthenticationSessionService } from '../authentication-session.service';
import { AuthenticationTokenService } from '../authentication-token.service';
import type { PinLoginDto } from '../dto/pin-login.dto';
import type { RequestWithCookies } from '../authentication.types';

@Injectable()
export class PinLoginCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: AuthenticationSessionService,
    private readonly tokenService: AuthenticationTokenService,
  ) {}

  async execute(
    dto: PinLoginDto,
    request: RequestWithCookies,
    response: Response,
  ) {
    const user =
      await this.sessionService.getUserWithValidRefreshToken(request);

    if (user.incorrectPINCounter >= this.tokenService.getPinRetriesNumber()) {
      throw new UnauthorizedException('Invalid PIN.');
    }

    const isPinValid = user.pin
      ? await verifyPassword(dto.pin, user.pin)
      : false;

    if (!isPinValid) {
      const incorrectPINCounter = user.incorrectPINCounter + 1;

      if (incorrectPINCounter >= this.tokenService.getPinRetriesNumber()) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            incorrectPINCounter,
            refreshTokenHash: null,
            refreshTokenValidTo: null,
          },
        });

        this.tokenService.clearAuthCookies(response);
        response.status(HttpStatus.UNAUTHORIZED);

        return {
          reason: AUTH_REDIRECT_REASONS.loginRequired,
          redirectTo: this.tokenService.getFrontendRedirect('/login'),
        };
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          incorrectPINCounter,
        },
      });

      throw new UnauthorizedException('Invalid PIN.');
    }

    const now = new Date();
    const refreshToken = this.tokenService.createRefreshToken();
    const refreshTokenHash = await this.tokenService.hashToken(refreshToken);
    const refreshTokenValidTo = this.tokenService.getRefreshTokenValidTo(now);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        incorrectPINCounter: 0,
        refreshTokenHash,
        refreshTokenValidTo,
      },
    });

    const accessToken = await this.tokenService.createAccessToken(user);

    this.tokenService.setAuthCookies({
      response,
      accessToken,
      refreshToken,
      userId: user.id,
    });

    return { success: true };
  }
}
