import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { StoredDeviceCustomer } from '../devices.types';

type DeviceCustomersReadTransactionClient = Prisma.TransactionClient;

@Injectable()
export class DeviceCustomersReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    tenantId: string,
    customerId: string,
    transaction?: DeviceCustomersReadTransactionClient,
  ): Promise<StoredDeviceCustomer | null> {
    const db = transaction ?? this.prisma;
    const row = await db.customer.findFirst({
      where: { id: customerId, tenantId, archivedAt: null },
      select: {
        id: true,
        tenantId: true,
        type: true,
        piiCiphertext: true,
        piiNonce: true,
        piiKeyVersion: true,
        piiFormatVersion: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return row
      ? {
          ...row,
          piiCiphertext: Buffer.from(row.piiCiphertext),
          piiNonce: Buffer.from(row.piiNonce),
        }
      : null;
  }
}
