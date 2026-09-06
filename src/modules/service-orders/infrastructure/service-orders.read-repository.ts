import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';
import {
  ServiceOrderType,
  type ServiceOrderStatus,
} from '@generated/prisma/enums';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { StoredInspectionServiceOrder } from '../service-orders.types';

type ServiceOrdersReadTransactionClient = Prisma.TransactionClient;

@Injectable()
export class ServiceOrdersReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findInspections(
    input: {
      readonly tenantId: string;
      readonly customerId: string;
      readonly statuses: readonly ServiceOrderStatus[];
      readonly excludeDeviceId?: string;
    },
    transaction?: ServiceOrdersReadTransactionClient,
  ): Promise<StoredInspectionServiceOrder[]> {
    const db = transaction ?? this.prisma;
    const rows = await db.serviceOrder.findMany({
      where: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        type: ServiceOrderType.inspection,
        status: { in: [...input.statuses] },
        ...(input.excludeDeviceId
          ? {
              devices: {
                none: { systemDeviceId: input.excludeDeviceId },
              },
            }
          : {}),
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      select: inspectionServiceOrderSelect,
    });

    return rows.map(mapInspectionServiceOrder);
  }

  async findActiveForDevice(
    tenantId: string,
    deviceId: string,
    statuses: readonly ServiceOrderStatus[],
    transaction?: ServiceOrdersReadTransactionClient,
  ): Promise<StoredInspectionServiceOrder | null> {
    const db = transaction ?? this.prisma;
    const row = await db.serviceOrder.findFirst({
      where: {
        tenantId,
        type: ServiceOrderType.inspection,
        status: { in: [...statuses] },
        devices: { some: { systemDeviceId: deviceId } },
      },
      orderBy: [{ orderDate: 'desc' }, { id: 'desc' }],
      select: inspectionServiceOrderSelect,
    });

    return row ? mapInspectionServiceOrder(row) : null;
  }
}

const inspectionServiceOrderSelect = {
  id: true,
  tenantId: true,
  customerId: true,
  customer: {
    select: {
      id: true,
      tenantId: true,
      piiCiphertext: true,
      piiNonce: true,
      piiKeyVersion: true,
      piiFormatVersion: true,
    },
  },
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

type InspectionServiceOrderRow = Prisma.ServiceOrderGetPayload<{
  select: typeof inspectionServiceOrderSelect;
}>;

function mapInspectionServiceOrder(
  row: InspectionServiceOrderRow,
): StoredInspectionServiceOrder {
  if (!row.customerId) {
    throw new Error('Inspection service order is missing customerId.');
  }

  if (!row.scheduledAt) {
    throw new Error('Inspection service order is missing scheduledAt.');
  }

  if (!row.customer) {
    throw new Error('Inspection service order customer is missing.');
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    customer: {
      id: row.customer.id,
      tenantId: row.customer.tenantId,
      piiCiphertext: Buffer.from(row.customer.piiCiphertext),
      piiNonce: Buffer.from(row.customer.piiNonce),
      piiKeyVersion: row.customer.piiKeyVersion,
      piiFormatVersion: row.customer.piiFormatVersion,
    },
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
