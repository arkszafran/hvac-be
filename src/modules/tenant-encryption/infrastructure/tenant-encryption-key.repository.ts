import { Injectable } from '@nestjs/common';
import { TenantEncryptionKeyStatus } from '@generated/prisma/enums';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { toPrismaBytes } from '../../../common/prisma/prisma-bytes';
import type { WrappedTenantDek } from '../../../common/encryption/encryption.types';

export type StoredTenantEncryptionKey = {
  readonly tenantId: string;
  readonly version: number;
  readonly wrappedDek: Buffer;
  readonly kekKeyName: string;
  readonly kekKeyVersion: string;
  readonly status: TenantEncryptionKeyStatus;
};

@Injectable()
export class TenantEncryptionKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(
    tenantId: string,
  ): Promise<StoredTenantEncryptionKey | null> {
    const key = await this.prisma.tenantEncryptionKey.findFirst({
      where: {
        tenantId,
        status: TenantEncryptionKeyStatus.active,
      },
      select: this.keySelect(),
    });

    return this.mapKey(key);
  }

  async findByVersion(
    tenantId: string,
    version: number,
  ): Promise<StoredTenantEncryptionKey | null> {
    const key = await this.prisma.tenantEncryptionKey.findUnique({
      where: {
        tenantId_version: { tenantId, version },
      },
      select: this.keySelect(),
    });

    return this.mapKey(key);
  }

  async findDecryptOnly(
    tenantId: string,
  ): Promise<StoredTenantEncryptionKey | null> {
    const key = await this.prisma.tenantEncryptionKey.findFirst({
      where: {
        tenantId,
        status: TenantEncryptionKeyStatus.decrypt_only,
      },
      orderBy: { version: 'asc' },
      select: this.keySelect(),
    });

    return this.mapKey(key);
  }

  async getNextVersion(tenantId: string): Promise<number> {
    const result = await this.prisma.tenantEncryptionKey.aggregate({
      where: { tenantId },
      _max: { version: true },
    });

    return (result._max.version ?? 0) + 1;
  }

  async startRotation(input: {
    readonly currentVersion: number;
    readonly nextKey: WrappedTenantDek;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantEncryptionKey.updateMany({
        where: {
          tenantId: input.nextKey.tenantId,
          version: input.currentVersion,
          status: TenantEncryptionKeyStatus.active,
        },
        data: { status: TenantEncryptionKeyStatus.decrypt_only },
      });

      if (updated.count !== 1) {
        throw new Error('Tenant encryption key state changed during rotation.');
      }

      await tx.tenantEncryptionKey.create({
        data: {
          tenantId: input.nextKey.tenantId,
          version: input.nextKey.version,
          wrappedDek: toPrismaBytes(input.nextKey.wrappedDek),
          kekKeyName: input.nextKey.kekKeyName,
          kekKeyVersion: input.nextKey.kekKeyVersion,
          status: TenantEncryptionKeyStatus.active,
        },
      });
    });
  }

  async finishRotation(tenantId: string, oldVersion: number): Promise<void> {
    const result = await this.prisma.tenantEncryptionKey.updateMany({
      where: {
        tenantId,
        version: oldVersion,
        status: TenantEncryptionKeyStatus.decrypt_only,
      },
      data: {
        status: TenantEncryptionKeyStatus.retired,
        retiredAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new Error('Tenant encryption key state changed during rotation.');
    }
  }

  async updateWrappedDek(input: WrappedTenantDek): Promise<void> {
    const result = await this.prisma.tenantEncryptionKey.updateMany({
      where: {
        tenantId: input.tenantId,
        version: input.version,
      },
      data: {
        wrappedDek: toPrismaBytes(input.wrappedDek),
        kekKeyName: input.kekKeyName,
        kekKeyVersion: input.kekKeyVersion,
      },
    });

    if (result.count !== 1) {
      throw new Error('Tenant encryption key does not exist.');
    }
  }

  private keySelect() {
    return {
      tenantId: true,
      version: true,
      wrappedDek: true,
      kekKeyName: true,
      kekKeyVersion: true,
      status: true,
    } as const;
  }

  private mapKey(
    key: {
      readonly tenantId: string;
      readonly version: number;
      readonly wrappedDek: Uint8Array;
      readonly kekKeyName: string;
      readonly kekKeyVersion: string;
      readonly status: TenantEncryptionKeyStatus;
    } | null,
  ): StoredTenantEncryptionKey | null {
    return key
      ? {
          ...key,
          wrappedDek: Buffer.from(key.wrappedDek),
        }
      : null;
  }
}
