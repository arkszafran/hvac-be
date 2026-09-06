import { Injectable } from '@nestjs/common';

import type {
  EncryptedPayload,
  EncryptionPurpose,
} from '../../../common/encryption/encryption.types';
import { ENCRYPTION_PURPOSES } from '../../../common/encryption/encryption.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { toPrismaBytes } from '../../../common/prisma/prisma-bytes';

export type RotatablePiiRecord = {
  readonly id: string;
  readonly purpose: EncryptionPurpose;
  readonly ciphertext: Buffer;
  readonly nonce: Buffer;
  readonly keyVersion: number;
  readonly formatVersion: number;
};

export type RotatedPiiRecord = {
  readonly source: RotatablePiiRecord;
  readonly encrypted: EncryptedPayload;
};

@Injectable()
export class TenantPiiRotationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findNextBatch(
    tenantId: string,
    keyVersion: number,
    batchSize: number,
  ): Promise<RotatablePiiRecord[]> {
    const customers = await this.prisma.customer.findMany({
      where: { tenantId, piiKeyVersion: keyVersion },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: {
        id: true,
        piiCiphertext: true,
        piiNonce: true,
        piiKeyVersion: true,
        piiFormatVersion: true,
      },
    });

    if (customers.length) {
      return customers.map((record) => ({
        id: record.id,
        purpose: ENCRYPTION_PURPOSES.customerPii,
        ciphertext: Buffer.from(record.piiCiphertext),
        nonce: Buffer.from(record.piiNonce),
        keyVersion: record.piiKeyVersion,
        formatVersion: record.piiFormatVersion,
      }));
    }

    const serviceOrders = await this.prisma.serviceOrder.findMany({
      where: { tenantId, customerSnapshotKeyVersion: keyVersion },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: {
        id: true,
        customerSnapshotCiphertext: true,
        customerSnapshotNonce: true,
        customerSnapshotKeyVersion: true,
        customerSnapshotFormatVersion: true,
      },
    });

    if (serviceOrders.length) {
      return serviceOrders.map((record) => {
        if (
          !record.customerSnapshotCiphertext ||
          !record.customerSnapshotNonce ||
          record.customerSnapshotKeyVersion === null ||
          record.customerSnapshotFormatVersion === null
        ) {
          throw new Error('Service order customer snapshot is incomplete.');
        }

        return {
          id: record.id,
          purpose: ENCRYPTION_PURPOSES.serviceOrderCustomerSnapshot,
          ciphertext: Buffer.from(record.customerSnapshotCiphertext),
          nonce: Buffer.from(record.customerSnapshotNonce),
          keyVersion: record.customerSnapshotKeyVersion,
          formatVersion: record.customerSnapshotFormatVersion,
        };
      });
    }

    const devices = await this.prisma.device.findMany({
      where: { tenantId, installationAddressKeyVersion: keyVersion },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: {
        id: true,
        installationAddressCiphertext: true,
        installationAddressNonce: true,
        installationAddressKeyVersion: true,
        installationAddressFormatVersion: true,
      },
    });

    return devices.flatMap((record) => {
      if (
        !record.installationAddressCiphertext ||
        !record.installationAddressNonce ||
        record.installationAddressKeyVersion === null ||
        record.installationAddressFormatVersion === null
      ) {
        return [];
      }

      return [
        {
          id: record.id,
          purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
          ciphertext: Buffer.from(record.installationAddressCiphertext),
          nonce: Buffer.from(record.installationAddressNonce),
          keyVersion: record.installationAddressKeyVersion,
          formatVersion: record.installationAddressFormatVersion,
        },
      ];
    });
  }

  async updateBatch(
    tenantId: string,
    oldKeyVersion: number,
    records: readonly RotatedPiiRecord[],
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      let updatedCount = 0;

      for (const record of records) {
        switch (record.source.purpose) {
          case ENCRYPTION_PURPOSES.customerPii: {
            const result = await tx.customer.updateMany({
              where: {
                tenantId,
                id: record.source.id,
                piiKeyVersion: oldKeyVersion,
              },
              data: {
                piiCiphertext: toPrismaBytes(record.encrypted.ciphertext),
                piiNonce: toPrismaBytes(record.encrypted.nonce),
                piiKeyVersion: record.encrypted.keyVersion,
                piiFormatVersion: record.encrypted.formatVersion,
              },
            });
            updatedCount += result.count;
            break;
          }
          case ENCRYPTION_PURPOSES.serviceOrderCustomerSnapshot: {
            const result = await tx.serviceOrder.updateMany({
              where: {
                tenantId,
                id: record.source.id,
                customerSnapshotKeyVersion: oldKeyVersion,
              },
              data: {
                customerSnapshotCiphertext: toPrismaBytes(
                  record.encrypted.ciphertext,
                ),
                customerSnapshotNonce: toPrismaBytes(record.encrypted.nonce),
                customerSnapshotKeyVersion: record.encrypted.keyVersion,
                customerSnapshotFormatVersion: record.encrypted.formatVersion,
              },
            });
            updatedCount += result.count;
            break;
          }
          case ENCRYPTION_PURPOSES.deviceInstallationAddress: {
            const result = await tx.device.updateMany({
              where: {
                tenantId,
                id: record.source.id,
                installationAddressKeyVersion: oldKeyVersion,
              },
              data: {
                installationAddressCiphertext: toPrismaBytes(
                  record.encrypted.ciphertext,
                ),
                installationAddressNonce: toPrismaBytes(record.encrypted.nonce),
                installationAddressKeyVersion: record.encrypted.keyVersion,
                installationAddressFormatVersion:
                  record.encrypted.formatVersion,
              },
            });
            updatedCount += result.count;
            break;
          }
        }
      }

      return updatedCount;
    });
  }

  async countReferences(tenantId: string, keyVersion: number): Promise<number> {
    const [customers, serviceOrders, devices] = await Promise.all([
      this.prisma.customer.count({
        where: { tenantId, piiKeyVersion: keyVersion },
      }),
      this.prisma.serviceOrder.count({
        where: { tenantId, customerSnapshotKeyVersion: keyVersion },
      }),
      this.prisma.device.count({
        where: { tenantId, installationAddressKeyVersion: keyVersion },
      }),
    ]);

    return customers + serviceOrders + devices;
  }
}
