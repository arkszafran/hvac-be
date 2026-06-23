import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@generated/prisma/enums';
import type { Response } from 'express';

import { PrismaService } from '../../common/prisma/prisma.service';
import { verifyPassword } from '../../common/security/password/password';
import { AuthenticationTokenService } from '../authentication-token.service';
import type { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: AuthenticationTokenService,
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
      throw new UnauthorizedException('Invalid credentials.');
    }

    const loginRetriesNumber = this.tokenService.getLoginRetriesNumber();

    if (
      user.status === UserStatus.blocked ||
      user.incorrectLoginCounter >= loginRetriesNumber
    ) {
      if (user.status !== UserStatus.blocked) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            status: UserStatus.blocked,
          },
        });
      }

      throw new UnauthorizedException('Invalid credentials.');
    }

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

      throw new UnauthorizedException('Invalid credentials.');
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

    return { success: true };
  }
}
