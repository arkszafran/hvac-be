import { Injectable } from '@nestjs/common';
import { AttachmentScanStatus } from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../common/encryption/encryption.types';
import type { TenantPiiCipherService } from '../tenant-encryption/tenant-pii-cipher.service';
import type {
  PendingAttachmentDto,
  VisitCustomerSummaryDto,
  VisitDeviceDto,
  VisitListItemDto,
  VisitServiceOrderDto,
} from './dto/visit-response.dto';
import type {
  StoredVisit,
  StoredVisitCustomer,
  StoredVisitDevice,
  StoredVisitServiceOrder,
  VisitCustomerPii,
} from './visits.types';
import {
  parseVisitCustomerPii,
  parseVisitInstallationAddress,
} from './visits.types';

@Injectable()
export class VisitsMapper {
  async mapVisit(
    visit: StoredVisit,
    piiCipher: TenantPiiCipherService,
  ): Promise<VisitListItemDto> {
    const customerPii = await this.decryptCustomer(visit.customer, piiCipher);

    return {
      id: visit.id,
      serviceOrderId: visit.serviceOrderId,
      type: visit.type,
      performedOn: formatDate(visit.date),
      handledBy: visit.user,
      customer: this.mapCustomer(visit.customer, customerPii),
      devices: await Promise.all(
        visit.devices.map(
          async ({ device, note }): Promise<VisitDeviceDto> => ({
            device: await this.mapDevice(device, customerPii, piiCipher),
            note: note ?? '',
          }),
        ),
      ),
      createdAt: visit.createdAt.toISOString(),
    };
  }

  mapPendingAttachment(
    attachment: StoredVisit['attachments'][number],
  ): PendingAttachmentDto {
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      description: attachment.description,
      status: AttachmentScanStatus.pending_upload,
      url: null,
      createdAt: attachment.createdAt.toISOString(),
      updatedAt: attachment.updatedAt.toISOString(),
    };
  }

  mapServiceOrder(order: StoredVisitServiceOrder): VisitServiceOrderDto {
    return {
      id: order.id,
      customerId: order.customerId,
      type: order.type,
      source: order.source,
      status: order.status,
      assigneeUserId: order.assigneeUserId,
      orderDate: order.orderDate.toISOString(),
      scheduledAt: order.scheduledAt?.toISOString() ?? null,
      nextContactAt: order.nextContactAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private async decryptCustomer(
    customer: StoredVisitCustomer,
    piiCipher: TenantPiiCipherService,
  ): Promise<VisitCustomerPii> {
    return parseVisitCustomerPii(
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

  private mapCustomer(
    customer: StoredVisitCustomer,
    pii: VisitCustomerPii,
  ): VisitCustomerSummaryDto {
    return {
      id: customer.id,
      type: customer.type,
      ...pii,
    };
  }

  private async mapDevice(
    device: StoredVisitDevice,
    customerPii: VisitCustomerPii,
    piiCipher: TenantPiiCipherService,
  ) {
    let address = {
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
        throw new Error('Visit device custom installation address is missing.');
      }

      address = parseVisitInstallationAddress(
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

    return {
      id: device.id,
      type: device.type,
      brand: device.brand,
      model: device.model,
      location: device.location ?? '',
      hasCustomInstallationAddress: device.hasCustomInstallationAddress,
      ...address,
    };
  }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
