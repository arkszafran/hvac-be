import { BadRequestException, Injectable } from '@nestjs/common';
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
  ) {}

  async execute(dto: UnlockAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: {
        id: true,
        accountUnlockCodeHash: true,
      },
    });

    if (!user?.accountUnlockCodeHash) {
      throwInvalidUnlockCodeException();
    }

    const isUnlockCodeValid = await this.tokenService.verifyToken(
      dto.code,
      user.accountUnlockCodeHash,
    );

    if (!isUnlockCodeValid) {
      throwInvalidUnlockCodeException();
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
      },
    });

    return apiSuccess();
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
