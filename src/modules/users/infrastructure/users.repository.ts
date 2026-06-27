import { Injectable } from '@nestjs/common';
import { UserRole, UserStatus, UserTenantRole } from '@generated/prisma/enums';

import { PrismaService } from '../../../common/prisma/prisma.service';

export type CreateTenantWithFirstUserInput = {
  readonly tenant: {
    readonly name: string;
    readonly personName: string;
    readonly street: string;
    readonly city: string;
    readonly zip: string;
    readonly tax: string;
  };
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly password: string;
  };
};

export type CreateTenantWithFirstUserResult = {
  readonly tenantId: string;
  readonly userId: string;
};

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserCredentialsById(userId: string): Promise<{
    readonly id: string;
    readonly password: string;
    readonly status: UserStatus;
  } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        status: true,
      },
    });
  }

  async hasUserWithEmail(email: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });

    return !!user;
  }

  async createTenantWithFirstUser(
    input: CreateTenantWithFirstUserInput,
  ): Promise<CreateTenantWithFirstUserResult> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.tenant.name,
          person_name: input.tenant.personName,
          street: input.tenant.street,
          city: input.tenant.city,
          zip: input.tenant.zip,
          tax: input.tenant.tax,
        },
        select: { id: true },
      });

      const user = await tx.user.create({
        data: {
          name: input.user.name,
          email: input.user.email,
          password: input.user.password,
          status: UserStatus.new,
          role: UserRole.TENANT_USER,
        },
        select: { id: true },
      });

      await tx.user_tenant.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role: UserTenantRole.ADMIN,
        },
      });

      return {
        tenantId: tenant.id,
        userId: user.id,
      };
    });
  }

  async setupNewUserCredentials(input: {
    readonly userId: string;
    readonly password: string;
    readonly pin: string;
  }): Promise<void> {
    await this.prisma.user.update({
      where: { id: input.userId },
      data: {
        password: input.password,
        pin: input.pin,
        status: UserStatus.active,
        incorrectLoginCounter: 0,
        incorrectPINCounter: 0,
      },
    });
  }

  async updatePassword(input: {
    readonly userId: string;
    readonly password: string;
  }): Promise<void> {
    await this.prisma.user.update({
      where: { id: input.userId },
      data: {
        password: input.password,
        incorrectLoginCounter: 0,
        refreshTokenHash: null,
        refreshTokenValidTo: null,
        sessionUnlockedUntil: null,
      },
    });
  }

  async updatePin(input: {
    readonly userId: string;
    readonly pin: string;
  }): Promise<void> {
    await this.prisma.user.update({
      where: { id: input.userId },
      data: {
        pin: input.pin,
        incorrectPINCounter: 0,
      },
    });
  }
}
