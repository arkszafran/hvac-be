import { Injectable } from '@nestjs/common';
import {
  AttachmentScanStatus,
  ServiceOrderType,
} from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../common/encryption/encryption.types';
import type { TenantPiiCipherService } from '../tenant-encryption/tenant-pii-cipher.service';
import type {
  CustomerSummaryDto,
  DeviceDto,
  DeviceListItemDto,
  DeviceVisitDto,
  InspectionServiceOrderDto,
  RelatedInspectionDeviceDto,
} from './dto/device-response.dto';
import {
  parseDeviceCustomerPii,
  parseDeviceInstallationAddress,
  type DeviceCustomerPii,
  type DeviceInstallationAddress,
  type StoredDevice,
  type StoredDeviceCustomer,
  type StoredDeviceInspection,
  type StoredDeviceVisit,
  type StoredRelatedDeviceInspectionDevice,
} from './devices.types';

@Injectable()
export class DevicesMapper {
  async decryptCustomer(
    customer: StoredDeviceCustomer,
    piiCipher: TenantPiiCipherService,
  ): Promise<DeviceCustomerPii> {
    return parseDeviceCustomerPii(
      await piiCipher.decryptJson({
        tenantId: customer.tenantId,
        recordId: customer.id,
        purpose: ENCRYPTION_PURPOSES.customerPii,
        encrypted: {
          ciphertext: customer.piiCiphertext,
          nonce: customer.piiNonce,
          keyVersion: customer.piiKeyVersion,
          formatVersion: customer.piiFormatVersion,
        },
      }),
    );
  }

  async decryptInstallationAddress(
    device: StoredDevice,
    piiCipher: TenantPiiCipherService,
  ): Promise<DeviceInstallationAddress> {
    if (
      !device.installationAddressCiphertext ||
      !device.installationAddressNonce ||
      device.installationAddressKeyVersion === null ||
      device.installationAddressFormatVersion === null
    ) {
      throw new Error('Device custom installation address is missing.');
    }

    return parseDeviceInstallationAddress(
      await piiCipher.decryptJson({
        tenantId: device.tenantId,
        recordId: device.id,
        purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
        encrypted: {
          ciphertext: device.installationAddressCiphertext,
          nonce: device.installationAddressNonce,
          keyVersion: device.installationAddressKeyVersion,
          formatVersion: device.installationAddressFormatVersion,
        },
      }),
    );
  }

  async mapDevice(
    device: StoredDevice,
    piiCipher: TenantPiiCipherService,
    knownAddress?: DeviceInstallationAddress,
  ): Promise<DeviceDto> {
    const address = device.hasCustomInstallationAddress
      ? (knownAddress ??
        (await this.decryptInstallationAddress(device, piiCipher)))
      : {
          address: '',
          postalCode: '',
          city: '',
        };

    return {
      id: device.id,
      customerId: device.customerId,
      type: device.type,
      brand: device.brand,
      model: device.model,
      powerKw: device.powerKw,
      serialNumber: device.serialNumber ?? '',
      installationDate: formatDate(device.installationDate),
      warrantyMonths: device.warrantyMonths,
      warrantyUntil: formatDate(device.warrantyUntil),
      note: device.note ?? '',
      refrigerant: device.refrigerant ?? '',
      refrigerantAmount: device.refrigerantAmount ?? '',
      location: device.location ?? '',
      hasCustomInstallationAddress: device.hasCustomInstallationAddress,
      ...address,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    };
  }

  mapCustomer(
    customer: StoredDeviceCustomer,
    pii: DeviceCustomerPii,
  ): CustomerSummaryDto {
    return {
      id: customer.id,
      type: customer.type,
      companyName: pii.companyName,
      fullName: pii.fullName,
      phone: pii.phone,
      email: pii.email,
      address: pii.address,
      postalCode: pii.postalCode,
      city: pii.city,
    };
  }

  async mapDeviceListItem(
    device: StoredDevice,
    customer: StoredDeviceCustomer,
    customerPii: DeviceCustomerPii,
    piiCipher: TenantPiiCipherService,
  ): Promise<DeviceListItemDto> {
    const installationAddress = device.hasCustomInstallationAddress
      ? await this.decryptInstallationAddress(device, piiCipher)
      : {
          address: customerPii.address,
          postalCode: customerPii.postalCode,
          city: customerPii.city,
        };

    return {
      id: device.id,
      customerId: device.customerId,
      type: device.type,
      brand: device.brand,
      model: device.model,
      location: device.location ?? '',
      hasCustomInstallationAddress: device.hasCustomInstallationAddress,
      ...installationAddress,
      customer: this.mapCustomer(customer, customerPii),
    };
  }

  mapVisits(
    deviceId: string,
    visits: readonly StoredDeviceVisit[],
  ): DeviceVisitDto[] {
    return visits.map((visit) => ({
      id: visit.id,
      deviceId,
      ...(visit.serviceOrderId ? { serviceOrderId: visit.serviceOrderId } : {}),
      customerId: visit.customerId,
      userName: visit.userName,
      date: formatDate(visit.date),
      type: visit.type,
      note: visit.note ?? '',
      photos: visit.photos.map((photo) => ({
        id: photo.id,
        fileName: photo.fileName,
        contentType: photo.contentType,
        sizeBytes: photo.sizeBytes,
        scanStatus: photo.scanStatus,
        canDownload: photo.scanStatus === AttachmentScanStatus.clean,
        ...(photo.description ? { description: photo.description } : {}),
      })),
      createdAt: visit.createdAt.toISOString(),
    }));
  }

  async mapInspection(
    inspection: StoredDeviceInspection,
    customerPii: DeviceCustomerPii,
    piiCipher: TenantPiiCipherService,
  ): Promise<InspectionServiceOrderDto> {
    const devices = await Promise.all(
      inspection.devices.map((device) =>
        this.mapInspectionDevice(
          inspection.tenantId,
          device,
          customerPii,
          piiCipher,
        ),
      ),
    );

    return {
      id: inspection.id,
      customerId: inspection.customerId,
      type: ServiceOrderType.inspection,
      source: inspection.source,
      status: inspection.status,
      orderDate: inspection.orderDate.toISOString(),
      scheduledAt: inspection.scheduledAt.toISOString(),
      serviceData: {
        type: ServiceOrderType.inspection,
        deviceIds: devices.map((device) => device.id),
        devices,
        customerConfirmationStatus: inspection.lastMessage
          ? (inspection.lastMessage.confirmationStatus ?? 'pending')
          : 'pending',
        confirmationReminderSentAt:
          inspection.lastMessage?.date.toISOString() ?? null,
      },
      createdAt: inspection.createdAt.toISOString(),
      updatedAt: inspection.updatedAt.toISOString(),
    };
  }

  private async mapInspectionDevice(
    tenantId: string,
    device: StoredRelatedDeviceInspectionDevice,
    customerPii: DeviceCustomerPii,
    piiCipher: TenantPiiCipherService,
  ): Promise<RelatedInspectionDeviceDto> {
    let address: DeviceInstallationAddress = {
      address: customerPii.address,
      postalCode: customerPii.postalCode,
      city: customerPii.city,
    };

    if (device.hasCustomInstallationAddress) {
      if (
        !device.installationAddressCiphertext ||
        !device.installationAddressNonce ||
        device.installationAddressKeyVersion === null ||
        device.installationAddressFormatVersion === null
      ) {
        throw new Error('Device custom installation address is missing.');
      }

      address = parseDeviceInstallationAddress(
        await piiCipher.decryptJson({
          tenantId,
          recordId: device.id,
          purpose: ENCRYPTION_PURPOSES.deviceInstallationAddress,
          encrypted: {
            ciphertext: device.installationAddressCiphertext,
            nonce: device.installationAddressNonce,
            keyVersion: device.installationAddressKeyVersion,
            formatVersion: device.installationAddressFormatVersion,
          },
        }),
      );
    }

    return {
      id: device.id,
      brand: device.brand,
      model: device.model,
      hasCustomInstallationAddress: device.hasCustomInstallationAddress,
      ...address,
    };
  }
}

function formatDate(value: Date | null): string {
  return value?.toISOString().slice(0, 10) ?? '';
}

export function parseDeviceDate(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function calculateWarrantyUntil(
  installationDate: Date | null,
  warrantyMonths: number,
): Date | null {
  if (!installationDate || warrantyMonths <= 0) {
    return null;
  }

  const year = installationDate.getUTCFullYear();
  const month = installationDate.getUTCMonth() + warrantyMonths;
  const day = installationDate.getUTCDate();
  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, month + 1, 0),
  ).getUTCDate();

  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth)));
}
