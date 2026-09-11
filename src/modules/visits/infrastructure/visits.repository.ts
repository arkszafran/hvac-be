import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';
import {
  ServiceOrderSource,
  ServiceOrderStatus,
  ServiceOrderType,
  type CustomerType,
  type VisitType,
} from '@generated/prisma/enums';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  StoredVisit,
  StoredVisitCustomer,
  StoredVisitDevice,
  StoredVisitServiceOrder,
} from '../visits.types';

export type VisitsTransactionClient = Prisma.TransactionClient;

type CreateVisitInput = {
  readonly id: string;
  readonly tenantId: string;
  readonly serviceOrderId: string | null;
  readonly customerId: string;
  readonly userId: string;
  readonly date: Date;
  readonly type: VisitType;
  readonly devices: ReadonlyArray<{
    readonly deviceId: string;
    readonly note: string;
    readonly sortOrder: number;
  }>;
};

@Injectable()
export class VisitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(
    work: (transaction: VisitsTransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(work);
  }

  async findServiceOrderForCompletion(
    tenantId: string,
    serviceOrderId: string,
    transaction: VisitsTransactionClient,
  ): Promise<StoredVisitServiceOrder | null> {
    return transaction.serviceOrder.findFirst({
      where: { id: serviceOrderId, tenantId },
      select: serviceOrderSelect,
    });
  }

  async completeServiceOrder(
    tenantId: string,
    serviceOrderId: string,
    transaction: VisitsTransactionClient,
  ): Promise<StoredVisitServiceOrder> {
    await transaction.serviceOrder.updateMany({
      where: { id: serviceOrderId, tenantId },
      data: { status: ServiceOrderStatus.completed },
    });

    const order = await this.findServiceOrderForCompletion(
      tenantId,
      serviceOrderId,
      transaction,
    );

    if (!order) {
      throw new Error('Completed service order disappeared in transaction.');
    }

    return order;
  }

  createNextInspection(
    input: {
      readonly id: string;
      readonly tenantId: string;
      readonly customerId: string;
      readonly customerType: CustomerType;
      readonly deviceIds: readonly string[];
      readonly scheduledAt: Date;
      readonly now: Date;
    },
    transaction: VisitsTransactionClient,
  ): Promise<StoredVisitServiceOrder> {
    return transaction.serviceOrder.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        customerId: input.customerId,
        customerType: input.customerType,
        type: ServiceOrderType.inspection,
        source: ServiceOrderSource.system,
        status: ServiceOrderStatus.new,
        orderDate: input.now,
        scheduledAt: input.scheduledAt,
        devices: {
          create: input.deviceIds.map((deviceId, sortOrder) => ({
            systemDeviceId: deviceId,
            sortOrder,
          })),
        },
      },
      select: serviceOrderSelect,
    });
  }

  async createVisit(
    input: CreateVisitInput,
    transaction: VisitsTransactionClient,
  ): Promise<StoredVisit> {
    const row = await transaction.visit.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        serviceOrderId: input.serviceOrderId,
        customerId: input.customerId,
        userId: input.userId,
        date: input.date,
        type: input.type,
        devices: {
          create: input.devices.map((device) => ({
            deviceId: device.deviceId,
            note: device.note || null,
            sortOrder: device.sortOrder,
          })),
        },
      },
      select: visitSelect,
    });

    return mapVisit(row);
  }

  async findVisitById(
    tenantId: string,
    visitId: string,
    transaction?: VisitsTransactionClient,
  ): Promise<StoredVisit | null> {
    const db = transaction ?? this.prisma;
    const row = await db.visit.findFirst({
      where: { id: visitId, tenantId },
      select: visitSelect,
    });

    return row ? mapVisit(row) : null;
  }

  findServiceOrderById(
    tenantId: string,
    serviceOrderId: string,
    transaction?: VisitsTransactionClient,
  ): Promise<StoredVisitServiceOrder | null> {
    const db = transaction ?? this.prisma;

    return db.serviceOrder.findFirst({
      where: { id: serviceOrderId, tenantId },
      select: serviceOrderSelect,
    });
  }
}

const customerSelect = {
  id: true,
  tenantId: true,
  type: true,
  piiCiphertext: true,
  piiNonce: true,
  piiKeyVersion: true,
  piiFormatVersion: true,
} satisfies Prisma.CustomerSelect;

const deviceSelect = {
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
} satisfies Prisma.DeviceSelect;

const attachmentSelect = {
  id: true,
  fileName: true,
  objectKey: true,
  contentType: true,
  sizeBytes: true,
  scanStatus: true,
  storageGeneration: true,
  uploadExpiresAt: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PhotoAttachmentSelect;

const visitSelect = {
  id: true,
  tenantId: true,
  serviceOrderId: true,
  date: true,
  type: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
  customer: { select: customerSelect },
  devices: {
    orderBy: [{ sortOrder: 'asc' as const }, { deviceId: 'asc' as const }],
    select: {
      note: true,
      device: { select: deviceSelect },
    },
  },
  photoAttachments: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    select: attachmentSelect,
  },
} satisfies Prisma.VisitSelect;

const serviceOrderSelect = {
  id: true,
  customerId: true,
  type: true,
  source: true,
  status: true,
  assigneeUserId: true,
  orderDate: true,
  scheduledAt: true,
  nextContactAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ServiceOrderSelect;

type CustomerRow = Prisma.CustomerGetPayload<{ select: typeof customerSelect }>;
type DeviceRow = Prisma.DeviceGetPayload<{ select: typeof deviceSelect }>;
type VisitRow = Prisma.VisitGetPayload<{ select: typeof visitSelect }>;

function mapCustomer(row: CustomerRow): StoredVisitCustomer {
  return {
    ...row,
    piiCiphertext: Buffer.from(row.piiCiphertext),
    piiNonce: Buffer.from(row.piiNonce),
  };
}

function mapDevice(row: DeviceRow): StoredVisitDevice {
  return {
    ...row,
    powerKw: row.powerKw === null ? null : Number(row.powerKw),
    installationAddressCiphertext: row.installationAddressCiphertext
      ? Buffer.from(row.installationAddressCiphertext)
      : null,
    installationAddressNonce: row.installationAddressNonce
      ? Buffer.from(row.installationAddressNonce)
      : null,
  };
}

function mapVisit(row: VisitRow): StoredVisit {
  return {
    id: row.id,
    tenantId: row.tenantId,
    serviceOrderId: row.serviceOrderId,
    date: row.date,
    type: row.type,
    createdAt: row.createdAt,
    user: row.user,
    customer: mapCustomer(row.customer),
    devices: row.devices
      .filter(
        (entry) =>
          entry.device.tenantId === row.tenantId &&
          entry.device.customerId === row.customer.id,
      )
      .map((entry) => ({
        note: entry.note,
        device: mapDevice(entry.device),
      })),
    attachments: row.photoAttachments,
  };
}
