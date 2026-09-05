import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  StoredCustomer,
  StoredCustomerDetails,
  StoredDevice,
  StoredServiceOrder,
} from '../customers.types';

type CustomersReadTransactionClient = Prisma.TransactionClient;

@Injectable()
export class CustomersReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    transaction?: CustomersReadTransactionClient,
  ): Promise<StoredCustomer[]> {
    const db = transaction ?? this.prisma;
    const rows = await db.customer.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: customerSelect,
    });

    return rows.map(mapCustomer);
  }

  async findById(
    tenantId: string,
    customerId: string,
    transaction?: CustomersReadTransactionClient,
  ): Promise<StoredCustomer | null> {
    const db = transaction ?? this.prisma;
    const row = await db.customer.findFirst({
      where: { id: customerId, tenantId, archivedAt: null },
      select: customerSelect,
    });

    return row ? mapCustomer(row) : null;
  }

  async findDetails(
    tenantId: string,
    customerId: string,
    transaction?: CustomersReadTransactionClient,
  ): Promise<StoredCustomerDetails | null> {
    const db = transaction ?? this.prisma;
    const customer = await this.findById(tenantId, customerId, transaction);

    if (!customer) {
      return null;
    }

    const [deviceRows, serviceOrderRows] = await Promise.all([
      db.device.findMany({
        where: { tenantId, customerId, archivedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          customerId: true,
          type: true,
          brand: true,
          model: true,
          serialNumber: true,
          installationDate: true,
          location: true,
          hasCustomInstallationAddress: true,
          installationAddressCiphertext: true,
          installationAddressNonce: true,
          installationAddressKeyVersion: true,
          installationAddressFormatVersion: true,
        },
      }),
      db.serviceOrder.findMany({
        where: { tenantId, customerId },
        orderBy: [{ orderDate: 'desc' }, { id: 'desc' }],
        select: {
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
          devices: {
            select: { systemDeviceId: true },
          },
        },
      }),
    ]);

    return {
      customer,
      devices: deviceRows.map(mapDevice),
      serviceOrders: serviceOrderRows.map((row): StoredServiceOrder => {
        if (!row.customerId) {
          throw new Error('Customer service order is missing customerId.');
        }

        return {
          id: row.id,
          customerId: row.customerId,
          type: row.type,
          source: row.source,
          status: row.status,
          assigneeUserId: row.assigneeUserId,
          orderDate: row.orderDate,
          scheduledAt: row.scheduledAt,
          nextContactAt: row.nextContactAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          deviceIds: row.devices.flatMap((device) =>
            device.systemDeviceId ? [device.systemDeviceId] : [],
          ),
        };
      }),
    };
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
  createdAt: true,
  updatedAt: true,
} as const;

function mapCustomer(row: {
  readonly id: string;
  readonly tenantId: string;
  readonly type: StoredCustomer['type'];
  readonly piiCiphertext: Uint8Array;
  readonly piiNonce: Uint8Array;
  readonly piiKeyVersion: number;
  readonly piiFormatVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): StoredCustomer {
  return {
    ...row,
    piiCiphertext: Buffer.from(row.piiCiphertext),
    piiNonce: Buffer.from(row.piiNonce),
  };
}

function mapDevice(row: {
  readonly id: string;
  readonly customerId: string;
  readonly type: StoredDevice['type'];
  readonly brand: string;
  readonly model: string;
  readonly serialNumber: string | null;
  readonly installationDate: Date | null;
  readonly location: string | null;
  readonly hasCustomInstallationAddress: boolean;
  readonly installationAddressCiphertext: Uint8Array | null;
  readonly installationAddressNonce: Uint8Array | null;
  readonly installationAddressKeyVersion: number | null;
  readonly installationAddressFormatVersion: number | null;
}): StoredDevice {
  return {
    ...row,
    installationAddressCiphertext: row.installationAddressCiphertext
      ? Buffer.from(row.installationAddressCiphertext)
      : null,
    installationAddressNonce: row.installationAddressNonce
      ? Buffer.from(row.installationAddressNonce)
      : null,
  };
}
