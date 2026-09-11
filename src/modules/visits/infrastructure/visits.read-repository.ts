import { Injectable } from '@nestjs/common';
import type { Prisma } from '@generated/prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { StoredVisit } from '../visits.types';

@Injectable()
export class VisitsReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<StoredVisit[]> {
    const rows = await this.prisma.visit.findMany({
      where: { tenantId },
      select: visitListSelect,
    });

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      serviceOrderId: row.serviceOrderId,
      date: row.date,
      type: row.type,
      createdAt: row.createdAt,
      user: row.user,
      customer: {
        ...row.customer,
        piiCiphertext: Buffer.from(row.customer.piiCiphertext),
        piiNonce: Buffer.from(row.customer.piiNonce),
      },
      devices: row.devices
        .filter(
          (entry) =>
            entry.device.tenantId === row.tenantId &&
            entry.device.customerId === row.customer.id,
        )
        .map((entry) => ({
          note: entry.note,
          device: {
            ...entry.device,
            powerKw:
              entry.device.powerKw === null
                ? null
                : Number(entry.device.powerKw),
            installationAddressCiphertext: entry.device
              .installationAddressCiphertext
              ? Buffer.from(entry.device.installationAddressCiphertext)
              : null,
            installationAddressNonce: entry.device.installationAddressNonce
              ? Buffer.from(entry.device.installationAddressNonce)
              : null,
          },
        })),
      attachments: [],
    }));
  }
}

const visitListSelect = {
  id: true,
  tenantId: true,
  serviceOrderId: true,
  date: true,
  type: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
  customer: {
    select: {
      id: true,
      tenantId: true,
      type: true,
      piiCiphertext: true,
      piiNonce: true,
      piiKeyVersion: true,
      piiFormatVersion: true,
    },
  },
  devices: {
    orderBy: [{ sortOrder: 'asc' as const }, { deviceId: 'asc' as const }],
    select: {
      note: true,
      device: {
        select: {
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
        },
      },
    },
  },
} satisfies Prisma.VisitSelect;
