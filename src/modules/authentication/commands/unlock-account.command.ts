import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@generated/prisma/enums';

import { apiError, apiSuccess } from '../../../common/types/api-response.type';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AUTH_ERROR_CODES } from '../authentication.constants';
import { AuthenticationTokenService } from '../authentication-token.service';
import type { UnlockAccountDto } from '../dto/unlock-account.dto';

@Injectable()
export class UnlockAccountCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: AuthenticationTokenService,
    private readonly configService: ConfigService,
  ) {}

  async execute(dto: UnlockAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: {
        id: true,
        accountUnlockCodeHash: true,
        accountUnlockCodeValidTo: true,
        accountUnlockIncorrectCounter: true,
      },
    });

    if (!user?.accountUnlockCodeHash || !user.accountUnlockCodeValidTo) {
      throwInvalidUnlockCodeException();
    }

    if (user.accountUnlockCodeValidTo <= new Date()) {
      throwAccountUnlockCodeExpiredException();
    }

    if (
      user.accountUnlockIncorrectCounter >=
      this.getAccountUnlockRetriesNumber()
    ) {
      throwAccountUnlockRetriesLimitReachedException();
    }

    const isUnlockCodeValid = await this.tokenService.verifyToken(
      dto.code,
      user.accountUnlockCodeHash,
    );

    if (!isUnlockCodeValid) {
      await this.handleInvalidUnlockCode(user.id);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.active,
        incorrectLoginCounter: 0,
        incorrectPINCounter: 0,
        refreshTokenHash: null,
        refreshTokenValidTo: null,
        accountUnlockCodeHash: null,
        accountUnlockCodeValidTo: null,
        accountUnlockIncorrectCounter: 0,
      },
    });

    return apiSuccess();
  }

  private async handleInvalidUnlockCode(userId: string): Promise<never> {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountUnlockIncorrectCounter: {
          increment: 1,
        },
      },
      select: {
        id: true,
        accountUnlockIncorrectCounter: true,
      },
    });

    if (
      updatedUser.accountUnlockIncorrectCounter >=
      this.getAccountUnlockRetriesNumber()
    ) {
      await this.prisma.user.update({
        where: { id: updatedUser.id },
        data: {
          accountUnlockCodeHash: null,
          accountUnlockCodeValidTo: null,
        },
      });

      throwAccountUnlockRetriesLimitReachedException();
    }

    throwInvalidUnlockCodeException();
  }

  private getAccountUnlockRetriesNumber(): number {
    return Number(
      this.configService.getOrThrow<string | number>(
        'ACCOUNT_UNLOCK_CODE_RETRIES_NUMBER',
      ),
    );
  }
}

function throwInvalidUnlockCodeException(): never {
  throw new BadRequestException(
    apiError({
      code: AUTH_ERROR_CODES.invalidAccountUnlockCode,
      message: 'Account unlock code is invalid.',
    }),
  );
}

function throwAccountUnlockCodeExpiredException(): never {
  throw new BadRequestException(
    apiError({
      code: AUTH_ERROR_CODES.accountUnlockCodeExpired,
      message: 'Account unlock code is expired.',
    }),
  );
}

function throwAccountUnlockRetriesLimitReachedException(): never {
  throw new BadRequestException(
    apiError({
      code: AUTH_ERROR_CODES.accountUnlockCodeRetriesLimitReached,
      message: 'Account unlock code retries limit reached.',
    }),
  );
}
