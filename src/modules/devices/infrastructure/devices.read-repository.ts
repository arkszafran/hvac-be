import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';
import {
  ServiceOrderType,
  type ServiceOrderStatus,
} from '@generated/prisma/enums';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  StoredDevice,
  StoredDeviceInspection,
  StoredDeviceListItem,
  StoredDeviceVisit,
} from '../devices.types';

type DevicesReadTransactionClient = Prisma.TransactionClient;

@Injectable()
export class DevicesReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    transaction?: DevicesReadTransactionClient,
  ): Promise<StoredDeviceListItem[]> {
    const db = transaction ?? this.prisma;
    const rows = await db.device.findMany({
      where: {
        tenantId,
        archivedAt: null,
        customer: { archivedAt: null },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: deviceListSelect,
    });

    return rows.map((row) => ({
      device: mapStoredDevice(row),
      customer: {
        ...row.customer,
        piiCiphertext: Buffer.from(row.customer.piiCiphertext),
        piiNonce: Buffer.from(row.customer.piiNonce),
      },
    }));
  }

  async findById(
    tenantId: string,
    deviceId: string,
    transaction?: DevicesReadTransactionClient,
  ): Promise<StoredDevice | null> {
    const db = transaction ?? this.prisma;
    const row = await db.device.findFirst({
      where: { id: deviceId, tenantId, archivedAt: null },
      select: deviceSelect,
    });

    return row ? mapStoredDevice(row) : null;
  }

  async findVisits(
    tenantId: string,
    deviceId: string,
    transaction?: DevicesReadTransactionClient,
  ): Promise<StoredDeviceVisit[]> {
    const db = transaction ?? this.prisma;
    const rows = await db.visit.findMany({
      where: {
        tenantId,
        devices: { some: { deviceId } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        serviceOrderId: true,
        customerId: true,
        date: true,
        type: true,
        createdAt: true,
        user: { select: { name: true } },
        devices: {
          where: { deviceId },
          select: { note: true },
        },
        photoAttachments: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            fileName: true,
            url: true,
            description: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      serviceOrderId: row.serviceOrderId,
      customerId: row.customerId,
      userName: row.user.name,
      date: row.date,
      type: row.type,
      note: row.devices[0]?.note ?? null,
      photos: row.photoAttachments,
      createdAt: row.createdAt,
    }));
  }

  async findActiveInspectionForDevice(
    tenantId: string,
    deviceId: string,
    statuses: readonly ServiceOrderStatus[],
    transaction?: DevicesReadTransactionClient,
  ): Promise<StoredDeviceInspection | null> {
    const db = transaction ?? this.prisma;
    const row = await db.serviceOrder.findFirst({
      where: {
        tenantId,
        type: ServiceOrderType.inspection,
        status: { in: [...statuses] },
        devices: { some: { systemDeviceId: deviceId } },
      },
      orderBy: [{ orderDate: 'desc' }, { id: 'desc' }],
      select: activeDeviceInspectionSelect,
    });

    if (!row) {
      return null;
    }

    if (!row.customerId) {
      throw new Error('Inspection service order is missing customerId.');
    }

    if (!row.scheduledAt) {
      throw new Error('Inspection service order is missing scheduledAt.');
    }

    return {
      id: row.id,
      tenantId: row.tenantId,
      customerId: row.customerId,
      source: row.source,
      status: row.status,
      orderDate: row.orderDate,
      scheduledAt: row.scheduledAt,
      lastMessage: row.messages[0]
        ? {
            date: row.messages[0].date,
            confirmationStatus: row.messages[0].confirmationStatus,
          }
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      devices: row.devices.flatMap(({ systemDevice }) => {
        if (!systemDevice || systemDevice.archivedAt) {
          return [];
        }

        return [
          {
            id: systemDevice.id,
            brand: systemDevice.brand,
            model: systemDevice.model,
            hasCustomInstallationAddress:
              systemDevice.hasCustomInstallationAddress,
            installationAddressCiphertext:
              systemDevice.installationAddressCiphertext === null
                ? null
                : Buffer.from(systemDevice.installationAddressCiphertext),
            installationAddressNonce:
              systemDevice.installationAddressNonce === null
                ? null
                : Buffer.from(systemDevice.installationAddressNonce),
            installationAddressKeyVersion:
              systemDevice.installationAddressKeyVersion,
            installationAddressFormatVersion:
              systemDevice.installationAddressFormatVersion,
          },
        ];
      }),
    };
  }
}

const activeDeviceInspectionSelect = {
  id: true,
  tenantId: true,
  customerId: true,
  source: true,
  status: true,
  orderDate: true,
  scheduledAt: true,
  createdAt: true,
  updatedAt: true,
  messages: {
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: {
      date: true,
      confirmationStatus: true,
    },
  },
  devices: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: {
      systemDevice: {
        select: {
          id: true,
          brand: true,
          model: true,
          archivedAt: true,
          hasCustomInstallationAddress: true,
          installationAddressCiphertext: true,
          installationAddressNonce: true,
          installationAddressKeyVersion: true,
          installationAddressFormatVersion: true,
        },
      },
    },
  },
} satisfies Prisma.ServiceOrderSelect;

export const deviceSelect = {
  id: true,
  tenantId: true,
  customerId: true,
  type: true,
  brand: true,
  model: true,
  powerKw: true,
  serialNumber: true,
  installationDate: true,
  warrantyMonths: true,
  warrantyUntil: true,
  note: true,
  refrigerant: true,
  refrigerantAmount: true,
  location: true,
  hasCustomInstallationAddress: true,
  installationAddressCiphertext: true,
  installationAddressNonce: true,
  installationAddressKeyVersion: true,
  installationAddressFormatVersion: true,
  createdAt: true,
  updatedAt: true,
} as const;

const deviceListSelect = {
  ...deviceSelect,
  customer: {
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
  },
} as const;

type DeviceRow = Prisma.DeviceGetPayload<{ select: typeof deviceSelect }>;

export function mapStoredDevice(row: DeviceRow): StoredDevice {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    type: row.type,
    brand: row.brand,
    model: row.model,
    powerKw: row.powerKw === null ? null : Number(row.powerKw),
    serialNumber: row.serialNumber,
    installationDate: row.installationDate,
    warrantyMonths: row.warrantyMonths,
    warrantyUntil: row.warrantyUntil,
    note: row.note,
    refrigerant: row.refrigerant,
    refrigerantAmount: row.refrigerantAmount,
    location: row.location,
    hasCustomInstallationAddress: row.hasCustomInstallationAddress,
    installationAddressCiphertext:
      row.installationAddressCiphertext === null
        ? null
        : Buffer.from(row.installationAddressCiphertext),
    installationAddressNonce:
      row.installationAddressNonce === null
        ? null
        : Buffer.from(row.installationAddressNonce),
    installationAddressKeyVersion: row.installationAddressKeyVersion,
    installationAddressFormatVersion: row.installationAddressFormatVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
