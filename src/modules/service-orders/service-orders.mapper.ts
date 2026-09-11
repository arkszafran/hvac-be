import { Injectable } from '@nestjs/common';
import {
  ServiceOrderType,
  type MessageConfirmationStatus,
} from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../common/encryption/encryption.types';
import { AttachmentDownloadService } from '../attachments/attachment-download.service';
import { TenantPiiCipherService } from '../tenant-encryption/tenant-pii-cipher.service';
import type {
  CustomerConfirmationStatus,
  ServiceOrderAttachmentDto,
  ServiceOrderDetailsWithAttachmentsDto,
  ServiceOrderDetailsWithoutAttachmentsDto,
  ServiceOrderNoteBaseDto,
  ServiceOrderRoomBaseDto,
} from './dto/service-order-details-response.dto';
import type {
  ServiceOrderCustomerDto,
  ServiceOrderDeviceDto,
  ServiceOrderDto,
  ServiceOrderListItemDto,
} from './dto/service-orders-list-response.dto';
import type {
  ServiceOrderAttachmentRow,
  ServiceOrderDetailsWithAttachmentsRow,
  ServiceOrderDetailsWithoutAttachmentsRow,
  ServiceOrderListRow,
} from './infrastructure/service-orders.read-repository';
import {
  parseServiceOrderCustomerPii,
  parseServiceOrderInstallationAddress,
  type ServiceOrderCustomerPii,
} from './service-orders.types';

type ServiceOrderBaseRow = ServiceOrderListRow;
type ServiceOrderDeviceRow = ServiceOrderListRow['devices'][number];

@Injectable()
export class ServiceOrdersMapper {
  constructor(
    private readonly piiCipher: TenantPiiCipherService,
    private readonly attachmentDownloadService: AttachmentDownloadService,
  ) {}

  async mapListItem(
    row: ServiceOrderListRow,
  ): Promise<ServiceOrderListItemDto> {
    const customerPii = await this.decryptCustomer(row);

    return {
      order: this.mapOrder(row),
      customer: this.mapCustomer(row, customerPii),
      assignee: row.assignee,
      devices: await Promise.all(
        row.devices.map((device) =>
          this.mapDevice(row.tenantId, device, customerPii),
        ),
      ),
    };
  }

  async mapDetailsWithoutAttachments(
    row: ServiceOrderDetailsWithoutAttachmentsRow,
  ): Promise<ServiceOrderDetailsWithoutAttachmentsDto> {
    const customerPii = await this.decryptCustomer(row);
    const devices = await Promise.all(
      row.devices.map((device) =>
        this.mapDevice(row.tenantId, device, customerPii),
      ),
    );

    return {
      attachmentsOmitted: true,
      order: this.mapOrder(row),
      customer: this.mapCustomer(row, customerPii),
      assignee: row.assignee,
      serviceData: this.mapServiceDataWithoutAttachments(row, devices),
      notes: row.notes.map(mapNote),
    };
  }

  async mapDetailsWithAttachments(
    row: ServiceOrderDetailsWithAttachmentsRow,
  ): Promise<ServiceOrderDetailsWithAttachmentsDto> {
    const customerPii = await this.decryptCustomer(row);
    const devices = await Promise.all(
      row.devices.map((device) =>
        this.mapDevice(row.tenantId, device, customerPii),
      ),
    );
    if (row.type === ServiceOrderType.installation) {
      if (!row.installationData) {
        throw new Error('Installation service order data is missing.');
      }

      return {
        attachmentsOmitted: false,
        order: this.mapOrder(row),
        customer: this.mapCustomer(row, customerPii),
        assignee: row.assignee,
        serviceData: {
          type: ServiceOrderType.installation,
          buildingType: row.installationData.buildingType,
          rooms: await Promise.all(
            row.rooms.map(async (room) => ({
              ...mapRoom(room),
              photos: await this.mapAttachments(
                row.tenantId,
                room.photoAttachments,
              ),
            })),
          ),
          photos: await this.mapAttachments(row.tenantId, row.photoAttachments),
        },
        notes: await Promise.all(
          row.notes.map(async (note) => ({
            ...mapNote(note),
            photos: await this.mapAttachments(
              row.tenantId,
              note.photoAttachments,
            ),
          })),
        ),
      };
    }

    const devicesWithPhotos = await Promise.all(
      row.devices.map(async (device, index) => ({
        ...devices[index],
        nameplatePhotos: await this.mapAttachments(
          row.tenantId,
          device.photoAttachments,
        ),
      })),
    );
    const common = {
      attachmentsOmitted: false as const,
      order: this.mapOrder(row),
      customer: this.mapCustomer(row, customerPii),
      assignee: row.assignee,
      notes: await Promise.all(
        row.notes.map(async (note) => ({
          ...mapNote(note),
          photos: await this.mapAttachments(
            row.tenantId,
            note.photoAttachments,
          ),
        })),
      ),
    };

    if (row.type === ServiceOrderType.repair) {
      return {
        ...common,
        serviceData: {
          type: ServiceOrderType.repair,
          devices: devicesWithPhotos,
        },
      };
    }

    return {
      ...common,
      serviceData: {
        type: ServiceOrderType.inspection,
        devices: devicesWithPhotos,
        ...mapConfirmation(row.messages[0]),
      },
    };
  }

  private mapServiceDataWithoutAttachments(
    row: ServiceOrderDetailsWithoutAttachmentsRow,
    devices: ServiceOrderDeviceDto[],
  ): ServiceOrderDetailsWithoutAttachmentsDto['serviceData'] {
    if (row.type === ServiceOrderType.installation) {
      if (!row.installationData) {
        throw new Error('Installation service order data is missing.');
      }

      return {
        type: ServiceOrderType.installation,
        buildingType: row.installationData.buildingType,
        rooms: row.rooms.map(mapRoom),
      };
    }

    if (row.type === ServiceOrderType.repair) {
      return { type: ServiceOrderType.repair, devices };
    }

    return {
      type: ServiceOrderType.inspection,
      devices,
      ...mapConfirmation(row.messages[0]),
    };
  }

  private mapOrder(row: ServiceOrderBaseRow): ServiceOrderDto {
    return {
      id: row.id,
      customerId: row.customerId,
      type: row.type,
      source: row.source,
      status: row.status,
      assigneeUserId: row.assigneeUserId,
      orderDate: row.orderDate.toISOString(),
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      nextContactAt: row.nextContactAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapCustomer(
    row: ServiceOrderBaseRow,
    pii: ServiceOrderCustomerPii,
  ): ServiceOrderCustomerDto {
    return {
      customerId: row.customerId,
      type: row.customerType,
      companyName: pii.companyName ?? '',
      fullName: pii.fullName ?? '',
      phone: pii.phone,
      email: pii.email,
      address: pii.address,
      postalCode: pii.postalCode,
      city: pii.city,
    };
  }

  private async decryptCustomer(
    row: ServiceOrderBaseRow,
  ): Promise<ServiceOrderCustomerPii> {
    if (
      row.customerSnapshotCiphertext &&
      row.customerSnapshotNonce &&
      row.customerSnapshotKeyVersion !== null &&
      row.customerSnapshotFormatVersion !== null
    ) {
      return parseServiceOrderCustomerPii(
        await this.piiCipher.decryptJson({
          tenantId: row.tenantId,
          recordId: row.id,
          purpose: ENCRYPTION_PURPOSES.serviceOrderCustomerSnapshot,
          encrypted: {
            ciphertext: Buffer.from(row.customerSnapshotCiphertext),
            nonce: Buffer.from(row.customerSnapshotNonce),
            keyVersion: row.customerSnapshotKeyVersion,
            formatVersion: row.customerSnapshotFormatVersion,
          },
        }),
      );
    }

    if (row.customer) {
      return parseServiceOrderCustomerPii(
        await this.piiCipher.decryptJson({
          tenantId: row.tenantId,
          recordId: row.customer.id,
          purpose: ENCRYPTION_PURPOSES.customerPii,
          encrypted: {
            ciphertext: Buffer.from(row.customer.piiCiphertext),
            nonce: Buffer.from(row.customer.piiNonce),
            keyVersion: row.customer.piiKeyVersion,
            formatVersion: row.customer.piiFormatVersion,
          },
        }),
      );
    }

    throw new Error('Service order customer data is missing.');
  }

  private async mapDevice(
    tenantId: string,
    device: ServiceOrderDeviceRow,
    customerPii: ServiceOrderCustomerPii,
  ): Promise<ServiceOrderDeviceDto> {
    const systemDevice =
      device.systemDevice?.tenantId === tenantId ? device.systemDevice : null;
    const type = device.deviceType ?? systemDevice?.type;

    if (!type) {
      throw new Error('Service order device type is missing.');
    }

    let address = {
      address: customerPii.address,
      postalCode: customerPii.postalCode,
      city: customerPii.city,
    };
    const hasCustomInstallationAddress =
      systemDevice?.hasCustomInstallationAddress ?? false;

    if (hasCustomInstallationAddress && systemDevice) {
      if (
        !systemDevice.installationAddressCiphertext ||
        !systemDevice.installationAddressNonce ||
        systemDevice.installationAddressKeyVersion === null ||
        systemDevice.installationAddressFormatVersion === null
      ) {
        throw new Error(
          'Service order device custom installation address is missing.',
        );
      }

      address = parseServiceOrderInstallationAddress(
        await this.piiCipher.decryptJson({
          tenantId,
          recordId: systemDevice.id,
          purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
          encrypted: {
            ciphertext: Buffer.from(systemDevice.installationAddressCiphertext),
            nonce: Buffer.from(systemDevice.installationAddressNonce),
            keyVersion: systemDevice.installationAddressKeyVersion,
            formatVersion: systemDevice.installationAddressFormatVersion,
          },
        }),
      );
    }

    return {
      id: device.id,
      deviceId: device.systemDeviceId,
      type,
      brand: device.brand ?? systemDevice?.brand ?? '',
      model: device.model ?? systemDevice?.model ?? '',
      serialNumber: device.serialNumber ?? systemDevice?.serialNumber ?? '',
      refrigerant: device.refrigerant ?? systemDevice?.refrigerant ?? '',
      refrigerantAmount:
        device.refrigerantAmount ?? systemDevice?.refrigerantAmount ?? '',
      displayedError: device.displayedError,
      location: systemDevice?.location ?? '',
      hasCustomInstallationAddress,
      ...address,
    };
  }

  private async mapAttachments(
    tenantId: string,
    attachments: readonly ServiceOrderAttachmentRow[],
  ): Promise<ServiceOrderAttachmentDto[]> {
    const downloads =
      await this.attachmentDownloadService.createAvailableDownloadLinks(
        tenantId,
        attachments,
      );

    return downloads.map(({ attachment, link }) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      status: attachment.scanStatus,
      description: attachment.description,
      url: link.url,
      urlExpiresAt: link.expiresAt.toISOString(),
      createdAt: attachment.createdAt.toISOString(),
      updatedAt: attachment.updatedAt.toISOString(),
    }));
  }
}

function mapRoom(room: {
  readonly id: string;
  readonly area: unknown;
  readonly height: unknown;
  readonly outdoorUnitPlace: ServiceOrderRoomBaseDto['outdoorUnitPlace'];
  readonly estimatedDistanceToOutdoorUnit: unknown;
  readonly floor: number;
}): ServiceOrderRoomBaseDto {
  return {
    id: room.id,
    area: Number(room.area),
    height: Number(room.height),
    outdoorUnitPlace: room.outdoorUnitPlace,
    estimatedDistanceToOutdoorUnit:
      room.estimatedDistanceToOutdoorUnit === null
        ? 0
        : Number(room.estimatedDistanceToOutdoorUnit),
    floor: room.floor,
  };
}

function mapNote(note: {
  readonly id: string;
  readonly content: string;
  readonly author: { readonly id: string; readonly name: string };
  readonly createdAt: Date;
  readonly updatedAt: Date | null;
}): ServiceOrderNoteBaseDto {
  return {
    id: note.id,
    content: note.content,
    author: note.author,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt?.toISOString() ?? null,
  };
}

function mapConfirmation(lastMessage?: {
  readonly date: Date;
  readonly confirmationStatus: MessageConfirmationStatus | null;
}): {
  readonly customerConfirmationStatus: CustomerConfirmationStatus;
  readonly confirmationReminderSentAt: string | null;
} {
  return {
    customerConfirmationStatus: lastMessage
      ? (lastMessage.confirmationStatus ?? 'pending')
      : 'pending',
    confirmationReminderSentAt: lastMessage?.date.toISOString() ?? null,
  };
}

export function normalizeServiceOrderSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/gi, (character) => (character === 'Ł' ? 'L' : 'l'))
    .toLocaleLowerCase('pl');
}
