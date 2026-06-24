import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';

import { apiError, apiSuccess } from '../../../common/types/api-response.type';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { verifyPassword } from '../../../common/security/password/password';
import { AUTH_ERROR_CODES } from '../authentication.constants';
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
      throwInvalidPinException();
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

        return apiError({
          code: AUTH_ERROR_CODES.loginRequired,
          message: 'Login is required.',
          details: {
            redirectTo: this.tokenService.getFrontendRedirect('/login'),
          },
        });
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          incorrectPINCounter,
        },
      });

      throwInvalidPinException();
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

    return apiSuccess();
  }
}

function throwInvalidPinException(): never {
  throw new UnauthorizedException(
    apiError({
      code: AUTH_ERROR_CODES.invalidPin,
      message: 'Invalid PIN.',
    }),
  );
}
