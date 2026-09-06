import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { Prisma } from '@generated/prisma/client';
import type { CustomerType, ServiceOrderStatus } from '@generated/prisma/enums';
import {
  ServiceOrderSource,
  ServiceOrderStatus as ServiceOrderStatusValue,
  ServiceOrderType,
} from '@generated/prisma/enums';

export type ServiceOrdersTransactionClient = Prisma.TransactionClient;

export type InspectionForMutation = {
  readonly id: string;
  readonly customerId: string | null;
  readonly status: ServiceOrderStatus;
  readonly deviceIds: readonly string[];
};

@Injectable()
export class ServiceOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findInspectionForMutation(
    tenantId: string,
    serviceOrderId: string,
    transaction: ServiceOrdersTransactionClient,
  ): Promise<InspectionForMutation | null> {
    const row = await transaction.serviceOrder.findFirst({
      where: {
        id: serviceOrderId,
        tenantId,
        type: ServiceOrderType.inspection,
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        devices: { select: { systemDeviceId: true } },
      },
    });

    return row
      ? {
          id: row.id,
          customerId: row.customerId,
          status: row.status,
          deviceIds: row.devices.flatMap(({ systemDeviceId }) =>
            systemDeviceId ? [systemDeviceId] : [],
          ),
        }
      : null;
  }

  async findActiveInspectionIdForDevice(
    tenantId: string,
    deviceId: string,
    activeStatuses: readonly ServiceOrderStatus[],
    transaction: ServiceOrdersTransactionClient,
    excludedServiceOrderId?: string,
  ): Promise<string | null> {
    const row = await transaction.serviceOrder.findFirst({
      where: {
        tenantId,
        type: ServiceOrderType.inspection,
        status: { in: [...activeStatuses] },
        ...(excludedServiceOrderId
          ? { id: { not: excludedServiceOrderId } }
          : {}),
        devices: { some: { systemDeviceId: deviceId } },
      },
      select: { id: true },
    });

    return row?.id ?? null;
  }

  async createInspection(
    input: {
      readonly id: string;
      readonly tenantId: string;
      readonly customerId: string;
      readonly customerType: CustomerType;
      readonly deviceId: string;
      readonly scheduledAt: Date;
      readonly now: Date;
    },
    transaction: ServiceOrdersTransactionClient,
  ): Promise<void> {
    await transaction.serviceOrder.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        customerId: input.customerId,
        customerType: input.customerType,
        type: ServiceOrderType.inspection,
        source: ServiceOrderSource.user,
        status: ServiceOrderStatusValue.new,
        orderDate: input.now,
        scheduledAt: input.scheduledAt,
        devices: {
          create: {
            systemDeviceId: input.deviceId,
            sortOrder: 0,
          },
        },
      },
    });
  }

  async attachDevice(
    serviceOrderId: string,
    deviceId: string,
    sortOrder: number,
    transaction: ServiceOrdersTransactionClient,
  ): Promise<void> {
    await transaction.serviceOrderDevice.create({
      data: {
        serviceOrderId,
        systemDeviceId: deviceId,
        sortOrder,
      },
    });
  }

  async detachDevice(
    serviceOrderId: string,
    deviceId: string,
    transaction: ServiceOrdersTransactionClient,
  ): Promise<void> {
    await transaction.serviceOrderDevice.deleteMany({
      where: { serviceOrderId, systemDeviceId: deviceId },
    });
  }

  async countDevices(
    serviceOrderId: string,
    transaction: ServiceOrdersTransactionClient,
  ): Promise<number> {
    return transaction.serviceOrderDevice.count({ where: { serviceOrderId } });
  }

  async deleteInspection(
    tenantId: string,
    serviceOrderId: string,
    transaction: ServiceOrdersTransactionClient,
  ): Promise<void> {
    await transaction.serviceOrder.deleteMany({
      where: {
        id: serviceOrderId,
        tenantId,
        type: ServiceOrderType.inspection,
      },
    });
  }

  async rescheduleInspection(
    tenantId: string,
    serviceOrderId: string,
    scheduledAt: Date,
    transaction: ServiceOrdersTransactionClient,
  ): Promise<void> {
    await transaction.serviceOrder.updateMany({
      where: {
        id: serviceOrderId,
        tenantId,
        type: ServiceOrderType.inspection,
      },
      data: { scheduledAt },
    });
  }
}
