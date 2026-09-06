import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';
import type { DeviceType } from '@generated/prisma/enums';

import type { EncryptedPayload } from '../../../common/encryption/encryption.types';
import { toPrismaBytes } from '../../../common/prisma/prisma-bytes';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { StoredDevice } from '../devices.types';
import { deviceSelect, mapStoredDevice } from './devices.read-repository';

export type DevicesTransactionClient = Prisma.TransactionClient;

export type PersistDeviceInput = {
  readonly id: string;
  readonly tenantId: string;
  readonly customerId: string;
  readonly type: DeviceType;
  readonly brand: string;
  readonly model: string;
  readonly powerKw: number | null;
  readonly serialNumber: string;
  readonly installationDate: Date | null;
  readonly warrantyMonths: number;
  readonly warrantyUntil: Date | null;
  readonly note: string;
  readonly refrigerant: string;
  readonly refrigerantAmount: string;
  readonly location: string;
  readonly hasCustomInstallationAddress: boolean;
  readonly encryptedInstallationAddress: EncryptedPayload | null;
};

type UpdateDeviceInput = Omit<
  PersistDeviceInput,
  'encryptedInstallationAddress'
> & {
  readonly encryptedInstallationAddress: EncryptedPayload | null | undefined;
};

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: PersistDeviceInput,
    transaction: DevicesTransactionClient,
  ): Promise<StoredDevice> {
    const row = await transaction.device.create({
      data: mapPersistenceData(input),
      select: deviceSelect,
    });

    return mapStoredDevice(row);
  }

  async update(
    input: UpdateDeviceInput,
    transaction: DevicesTransactionClient,
  ): Promise<StoredDevice | null> {
    const result = await transaction.device.updateMany({
      where: {
        id: input.id,
        tenantId: input.tenantId,
        customerId: input.customerId,
        archivedAt: null,
      },
      data: mapPersistenceData(input),
    });

    if (result.count !== 1) {
      return null;
    }

    const row = await transaction.device.findFirst({
      where: {
        id: input.id,
        tenantId: input.tenantId,
        customerId: input.customerId,
        archivedAt: null,
      },
      select: deviceSelect,
    });

    return row ? mapStoredDevice(row) : null;
  }
}

function mapPersistenceData(input: PersistDeviceInput | UpdateDeviceInput) {
  const encrypted = input.encryptedInstallationAddress;
  const installationAddressData =
    encrypted === undefined
      ? {}
      : {
          installationAddressCiphertext: encrypted
            ? toPrismaBytes(encrypted.ciphertext)
            : null,
          installationAddressNonce: encrypted
            ? toPrismaBytes(encrypted.nonce)
            : null,
          installationAddressKeyVersion: encrypted?.keyVersion ?? null,
          installationAddressFormatVersion: encrypted?.formatVersion ?? null,
        };

  return {
    id: input.id,
    tenantId: input.tenantId,
    customerId: input.customerId,
    type: input.type,
    brand: input.brand,
    model: input.model,
    powerKw: input.powerKw,
    serialNumber: input.serialNumber || null,
    installationDate: input.installationDate,
    warrantyMonths: input.warrantyMonths,
    warrantyUntil: input.warrantyUntil,
    note: input.note || null,
    refrigerant: input.refrigerant || null,
    refrigerantAmount: input.refrigerantAmount || null,
    location: input.location || null,
    hasCustomInstallationAddress: input.hasCustomInstallationAddress,
    ...installationAddressData,
  };
}
