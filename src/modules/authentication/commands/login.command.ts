import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@generated/prisma/enums';
import type { Response } from 'express';

import { apiError, apiSuccess } from '../../../common/types/api-response.type';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { verifyPassword } from '../../../common/security/password/password';
import { AUTH_ERROR_CODES } from '../authentication.constants';
import { AuthenticationAccountStatusService } from '../authentication-account-status.service';
import { AuthenticationTokenService } from '../authentication-token.service';
import type { LoginDto } from '../dto/login.dto';
import { AuthenticationMailType } from '../mails/authentication-mail-type.enum';
import { AuthenticationMailQueueService } from '../mails/authentication-mail-queue.service';

@Injectable()
export class LoginCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: AuthenticationTokenService,
    private readonly mailQueueService: AuthenticationMailQueueService,
    private readonly accountStatusService: AuthenticationAccountStatusService,
  ) {}

  async execute(dto: LoginDto, response: Response) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: {
        tenants: {
          select: {
            tenantId: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      throwInvalidCredentialsException();
    }

    await this.accountStatusService.throwIfBlocked(user);

    const loginRetriesNumber = this.tokenService.getLoginRetriesNumber();

    const isPasswordValid = await verifyPassword(dto.password, user.password);

    if (!isPasswordValid) {
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          incorrectLoginCounter: {
            increment: 1,
          },
        },
        select: {
          id: true,
          accountUnlockCodeHash: true,
          incorrectLoginCounter: true,
        },
      });

      if (updatedUser.incorrectLoginCounter >= loginRetriesNumber) {
        const blockResult = await this.prisma.user.updateMany({
          where: {
            id: updatedUser.id,
            status: {
              not: UserStatus.blocked,
            },
          },
          data: {
            status: UserStatus.blocked,
          },
        });

        if (blockResult.count > 0 && !updatedUser.accountUnlockCodeHash) {
          await this.mailQueueService.queueEmail({
            userId: updatedUser.id,
            type: AuthenticationMailType.ACCOUNT_UNLOCK,
          });
        }

        throwLoginRetriesLimitReachedException();
      }

      throwInvalidCredentialsException();
    }

    const now = new Date();
    const refreshToken = this.tokenService.createRefreshToken();
    const refreshTokenHash = await this.tokenService.hashToken(refreshToken);
    const refreshTokenValidTo = this.tokenService.getRefreshTokenValidTo(now);
    const sessionUnlockedUntil = this.tokenService.getSessionUnlockedUntil(now);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        sessionUnlockedUntil,
        incorrectLoginCounter: 0,
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

function throwInvalidCredentialsException(): never {
  throw new UnauthorizedException(
    apiError({
      code: AUTH_ERROR_CODES.invalidCredentials,
      message: 'Invalid credentials.',
    }),
  );
}

function throwLoginRetriesLimitReachedException(): never {
  throw new UnauthorizedException(
    apiError({
      code: AUTH_ERROR_CODES.loginRetriesLimitReached,
      message: 'Login retries limit reached.',
    }),
  );
}
