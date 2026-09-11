import { Injectable } from '@nestjs/common';
import { ServiceOrderType } from '@generated/prisma/enums';

import { ENCRYPTION_PURPOSES } from '../../common/encryption/encryption.types';
import type { TenantPiiCipherService } from '../tenant-encryption/tenant-pii-cipher.service';
import type {
  InspectionServiceOrderDto,
  RelatedInspectionDeviceDto,
} from './dto/service-order-response.dto';
import {
  parseServiceOrderCustomerPii,
  parseServiceOrderInstallationAddress,
  type ServiceOrderCustomerPii,
  type StoredInspectionServiceOrder,
  type StoredRelatedInspectionDevice,
} from './service-orders.types';

@Injectable()
export class InspectionServiceOrderMapper {
  async map(
    order: StoredInspectionServiceOrder,
    piiCipher: TenantPiiCipherService,
  ): Promise<InspectionServiceOrderDto> {
    const customerPii = await this.decryptCustomer(order, piiCipher);
    const devices = await Promise.all(
      order.devices.map((device) =>
        this.mapDevice(order.tenantId, device, customerPii, piiCipher),
      ),
    );

    return {
      id: order.id,
      customerId: order.customerId,
      type: ServiceOrderType.inspection,
      source: order.source,
      status: order.status,
      orderDate: order.orderDate.toISOString(),
      scheduledAt: order.scheduledAt.toISOString(),
      serviceData: {
        type: ServiceOrderType.inspection,
        deviceIds: devices.map((device) => device.id),
        devices,
        customerConfirmationStatus: mapCustomerConfirmationStatus(order),
        confirmationReminderSentAt:
          order.lastMessage?.date.toISOString() ?? null,
      },
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private async decryptCustomer(
    order: StoredInspectionServiceOrder,
    piiCipher: TenantPiiCipherService,
  ): Promise<ServiceOrderCustomerPii> {
    return parseServiceOrderCustomerPii(
      await piiCipher.decryptJson({
        tenantId: order.customer.tenantId,
        recordId: order.customer.id,
        purpose: ENCRYPTION_PURPOSES.customerPii,
        encrypted: {
          ciphertext: order.customer.piiCiphertext,
          nonce: order.customer.piiNonce,
          keyVersion: order.customer.piiKeyVersion,
          formatVersion: order.customer.piiFormatVersion,
        },
      }),
    );
  }

  private async mapDevice(
    tenantId: string,
    device: StoredRelatedInspectionDevice,
    customerPii: ServiceOrderCustomerPii,
    piiCipher: TenantPiiCipherService,
  ): Promise<RelatedInspectionDeviceDto> {
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
        throw new Error('Device custom installation address is missing.');
      }

      address = parseServiceOrderInstallationAddress(
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

function mapCustomerConfirmationStatus(
  order: StoredInspectionServiceOrder,
): 'pending' | 'confirmed' | 'not_confirmed' {
  if (!order.lastMessage) {
    return 'pending';
  }

  return order.lastMessage.confirmationStatus ?? 'pending';
}
