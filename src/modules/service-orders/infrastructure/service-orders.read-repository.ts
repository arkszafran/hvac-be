import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';
import {
  AttachmentScanStatus,
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

  findList(input: {
    readonly tenantId: string;
    readonly customerId?: string;
    readonly type?: ServiceOrderType;
    readonly statuses?: readonly ServiceOrderStatus[];
    readonly excludeDeviceId?: string;
  }): Promise<ServiceOrderListRow[]> {
    return this.prisma.serviceOrder.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.customerId ? { customerId: input.customerId } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.statuses ? { status: { in: [...input.statuses] } } : {}),
        ...(input.excludeDeviceId
          ? {
              devices: {
                none: { systemDeviceId: input.excludeDeviceId },
              },
            }
          : {}),
      },
      select: serviceOrderListSelect,
    });
  }

  findDetailsWithoutAttachments(
    tenantId: string,
    serviceOrderId: string,
  ): Promise<ServiceOrderDetailsWithoutAttachmentsRow | null> {
    return this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, tenantId },
      select: serviceOrderDetailsWithoutAttachmentsSelect,
    });
  }

  findDetailsWithAttachments(
    tenantId: string,
    serviceOrderId: string,
  ): Promise<ServiceOrderDetailsWithAttachmentsRow | null> {
    return this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, tenantId },
      select: serviceOrderDetailsWithAttachmentsSelect,
    });
  }
}

const encryptedCustomerSelect = {
  id: true,
  tenantId: true,
  piiCiphertext: true,
  piiNonce: true,
  piiKeyVersion: true,
  piiFormatVersion: true,
} satisfies Prisma.CustomerSelect;

const systemDeviceSelect = {
  id: true,
  tenantId: true,
  type: true,
  brand: true,
  model: true,
  serialNumber: true,
  refrigerant: true,
  refrigerantAmount: true,
  location: true,
  hasCustomInstallationAddress: true,
  installationAddressCiphertext: true,
  installationAddressNonce: true,
  installationAddressKeyVersion: true,
  installationAddressFormatVersion: true,
} satisfies Prisma.DeviceSelect;

const orderDeviceBaseSelect = {
  id: true,
  systemDeviceId: true,
  deviceType: true,
  brand: true,
  model: true,
  serialNumber: true,
  refrigerant: true,
  refrigerantAmount: true,
  displayedError: true,
  sortOrder: true,
  systemDevice: { select: systemDeviceSelect },
} satisfies Prisma.ServiceOrderDeviceSelect;

const serviceOrderCoreSelect = {
  id: true,
  tenantId: true,
  customerId: true,
  customerType: true,
  customerSnapshotCiphertext: true,
  customerSnapshotNonce: true,
  customerSnapshotKeyVersion: true,
  customerSnapshotFormatVersion: true,
  type: true,
  source: true,
  status: true,
  assigneeUserId: true,
  orderDate: true,
  scheduledAt: true,
  nextContactAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: encryptedCustomerSelect },
  assignee: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ServiceOrderSelect;

const serviceOrderListSelect = {
  ...serviceOrderCoreSelect,
  devices: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    select: orderDeviceBaseSelect,
  },
} satisfies Prisma.ServiceOrderSelect;

const roomBaseSelect = {
  id: true,
  area: true,
  height: true,
  outdoorUnitPlace: true,
  estimatedDistanceToOutdoorUnit: true,
  floor: true,
  sortOrder: true,
} satisfies Prisma.ServiceOrderRoomSelect;

const noteBaseSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.ServiceOrderNoteSelect;

const cleanAttachmentSelect = {
  id: true,
  tenantId: true,
  fileName: true,
  objectKey: true,
  contentType: true,
  sizeBytes: true,
  scanStatus: true,
  storageGeneration: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PhotoAttachmentSelect;

const latestMessageSelect = {
  orderBy: [
    { date: 'desc' as const },
    { createdAt: 'desc' as const },
    { id: 'desc' as const },
  ],
  take: 1,
  select: { date: true, confirmationStatus: true },
} satisfies Prisma.ServiceOrder$messagesArgs;

const serviceOrderDetailsWithoutAttachmentsSelect = {
  ...serviceOrderCoreSelect,
  installationData: { select: { buildingType: true } },
  rooms: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    select: roomBaseSelect,
  },
  devices: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    select: orderDeviceBaseSelect,
  },
  notes: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: noteBaseSelect,
  },
  messages: latestMessageSelect,
} satisfies Prisma.ServiceOrderSelect;

const attachmentsRelation = {
  where: { scanStatus: AttachmentScanStatus.clean },
  orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
  select: cleanAttachmentSelect,
};

const serviceOrderDetailsWithAttachmentsSelect = {
  ...serviceOrderCoreSelect,
  installationData: { select: { buildingType: true } },
  rooms: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    select: {
      ...roomBaseSelect,
      photoAttachments: attachmentsRelation,
    },
  },
  devices: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    select: {
      ...orderDeviceBaseSelect,
      photoAttachments: attachmentsRelation,
    },
  },
  notes: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      ...noteBaseSelect,
      photoAttachments: attachmentsRelation,
    },
  },
  messages: latestMessageSelect,
  photoAttachments: attachmentsRelation,
} satisfies Prisma.ServiceOrderSelect;

export type ServiceOrderListRow = Prisma.ServiceOrderGetPayload<{
  select: typeof serviceOrderListSelect;
}>;

export type ServiceOrderDetailsWithoutAttachmentsRow =
  Prisma.ServiceOrderGetPayload<{
    select: typeof serviceOrderDetailsWithoutAttachmentsSelect;
  }>;

export type ServiceOrderDetailsWithAttachmentsRow =
  Prisma.ServiceOrderGetPayload<{
    select: typeof serviceOrderDetailsWithAttachmentsSelect;
  }>;

export type ServiceOrderAttachmentRow =
  ServiceOrderDetailsWithAttachmentsRow['photoAttachments'][number];

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
