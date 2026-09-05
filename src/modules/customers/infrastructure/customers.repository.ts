import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';
import type { CustomerType } from '@generated/prisma/enums';

import type { EncryptedPayload } from '../../../common/encryption/encryption.types';
import { toPrismaBytes } from '../../../common/prisma/prisma-bytes';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { StoredCustomerMetadata } from '../customers.types';

export type CustomersTransactionClient = Prisma.TransactionClient;

export type CreateStoredCustomerInput = {
  readonly id: string;
  readonly tenantId: string;
  readonly type: CustomerType;
  readonly encryptedPii: EncryptedPayload;
  readonly emailLookupHash: Buffer;
  readonly emailLookupKeyVersion: number;
};

export type UpdateStoredCustomerInput = CreateStoredCustomerInput;

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateId(transaction?: CustomersTransactionClient): Promise<string> {
    const db = transaction ?? this.prisma;
    const rows = await db.$queryRaw<Array<{ readonly id: string }>>`
      SELECT gen_random_uuid()::text AS id
    `;
    const generatedId = rows[0]?.id;

    if (!generatedId) {
      throw new Error('Database did not generate a customer id.');
    }

    return generatedId;
  }

  async hasEmailLookupHash(
    tenantId: string,
    emailLookupHash: Buffer,
    transaction?: CustomersTransactionClient,
    excludedCustomerId?: string,
  ): Promise<boolean> {
    const db = transaction ?? this.prisma;
    const customer = await db.customer.findFirst({
      where: {
        tenantId,
        archivedAt: null,
        emailLookupHash: toPrismaBytes(emailLookupHash),
        ...(excludedCustomerId ? { id: { not: excludedCustomerId } } : {}),
      },
      select: { id: true },
    });

    return customer !== null;
  }

  async create(
    input: CreateStoredCustomerInput,
    transaction?: CustomersTransactionClient,
  ): Promise<StoredCustomerMetadata> {
    const db = transaction ?? this.prisma;

    return db.customer.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        type: input.type,
        piiCiphertext: toPrismaBytes(input.encryptedPii.ciphertext),
        piiNonce: toPrismaBytes(input.encryptedPii.nonce),
        piiKeyVersion: input.encryptedPii.keyVersion,
        piiFormatVersion: input.encryptedPii.formatVersion,
        emailLookupHash: toPrismaBytes(input.emailLookupHash),
        emailLookupKeyVersion: input.emailLookupKeyVersion,
      },
      select: {
        id: true,
        tenantId: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(
    input: UpdateStoredCustomerInput,
    transaction?: CustomersTransactionClient,
  ): Promise<StoredCustomerMetadata | null> {
    const db = transaction ?? this.prisma;
    const result = await db.customer.updateMany({
      where: {
        id: input.id,
        tenantId: input.tenantId,
        archivedAt: null,
      },
      data: {
        type: input.type,
        piiCiphertext: toPrismaBytes(input.encryptedPii.ciphertext),
        piiNonce: toPrismaBytes(input.encryptedPii.nonce),
        piiKeyVersion: input.encryptedPii.keyVersion,
        piiFormatVersion: input.encryptedPii.formatVersion,
        emailLookupHash: toPrismaBytes(input.emailLookupHash),
        emailLookupKeyVersion: input.emailLookupKeyVersion,
      },
    });

    if (result.count !== 1) {
      return null;
    }

    return db.customer.findFirst({
      where: {
        id: input.id,
        tenantId: input.tenantId,
        archivedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
