import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@generated/prisma/enums';
import type { Response } from 'express';

import { apiError, apiSuccess } from '../../../common/types/api-response.type';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { verifyPassword } from '../../../common/security/password/password';
import { AUTH_ERROR_CODES } from '../authentication.constants';
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

    if (user.status === UserStatus.blocked) {
      await this.queueAccountUnlockEmailIfNeeded(user);

      throwLoginRetriesLimitReachedException();
    }

    const loginRetriesNumber = this.tokenService.getLoginRetriesNumber();

    const isPasswordValid = await verifyPassword(dto.password, user.password);

    if (!isPasswordValid) {
      const incorrectLoginCounter = user.incorrectLoginCounter + 1;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          incorrectLoginCounter,
          status:
            incorrectLoginCounter >= loginRetriesNumber
              ? UserStatus.blocked
              : user.status,
        },
      });

      if (incorrectLoginCounter >= loginRetriesNumber) {
        await this.mailQueueService.queueEmail({
          userId: user.id,
          type: AuthenticationMailType.ACCOUNT_UNLOCK,
        });

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

  private async queueAccountUnlockEmailIfNeeded(user: {
    readonly id: string;
    readonly accountUnlockCodeHash: string | null;
  }): Promise<void> {
    if (user.accountUnlockCodeHash) {
      return;
    }

    await this.mailQueueService.queueEmail({
      userId: user.id,
      type: AuthenticationMailType.ACCOUNT_UNLOCK,
    });
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
