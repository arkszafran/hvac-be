import type {
  CustomerType,
  DeviceType,
  MessageConfirmationStatus,
  ServiceOrderSource,
  ServiceOrderStatus,
  VisitType,
} from '@generated/prisma/enums';

export type DeviceCustomerPii = {
  readonly companyName: string | null;
  readonly fullName: string | null;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
};

export type StoredDeviceCustomer = {
  readonly id: string;
  readonly tenantId: string;
  readonly type: CustomerType;
  readonly piiCiphertext: Buffer;
  readonly piiNonce: Buffer;
  readonly piiKeyVersion: number;
  readonly piiFormatVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type DeviceInstallationAddress = {
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
};

export type StoredDevice = {
  readonly id: string;
  readonly tenantId: string;
  readonly customerId: string;
  readonly type: DeviceType;
  readonly brand: string;
  readonly model: string;
  readonly powerKw: number | null;
  readonly serialNumber: string | null;
  readonly installationDate: Date | null;
  readonly warrantyMonths: number;
  readonly warrantyUntil: Date | null;
  readonly note: string | null;
  readonly refrigerant: string | null;
  readonly refrigerantAmount: string | null;
  readonly location: string | null;
  readonly hasCustomInstallationAddress: boolean;
  readonly installationAddressCiphertext: Buffer | null;
  readonly installationAddressNonce: Buffer | null;
  readonly installationAddressKeyVersion: number | null;
  readonly installationAddressFormatVersion: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type StoredDeviceListItem = {
  readonly device: StoredDevice;
  readonly customer: StoredDeviceCustomer;
};

export type StoredDeviceVisit = {
  readonly id: string;
  readonly serviceOrderId: string | null;
  readonly customerId: string;
  readonly userName: string;
  readonly date: Date;
  readonly type: VisitType;
  readonly note: string | null;
  readonly photos: Array<{
    readonly id: string;
    readonly fileName: string;
    readonly url: string;
    readonly description: string | null;
  }>;
  readonly createdAt: Date;
};

export type StoredRelatedDeviceInspectionDevice = {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly hasCustomInstallationAddress: boolean;
  readonly installationAddressCiphertext: Buffer | null;
  readonly installationAddressNonce: Buffer | null;
  readonly installationAddressKeyVersion: number | null;
  readonly installationAddressFormatVersion: number | null;
};

export type StoredDeviceInspection = {
  readonly id: string;
  readonly tenantId: string;
  readonly customerId: string;
  readonly source: ServiceOrderSource;
  readonly status: ServiceOrderStatus;
  readonly orderDate: Date;
  readonly scheduledAt: Date;
  readonly lastMessage: {
    readonly date: Date;
    readonly confirmationStatus: MessageConfirmationStatus | null;
  } | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly devices: StoredRelatedDeviceInspectionDevice[];
};

export function parseDeviceCustomerPii(value: unknown): DeviceCustomerPii {
  if (!isRecord(value)) {
    throw new Error('Decrypted customer PII is invalid.');
  }

  const fields = [
    'companyName',
    'fullName',
    'phone',
    'email',
    'address',
    'postalCode',
    'city',
  ] as const;

  if (
    fields.some((field) => {
      const fieldValue = value[field];

      return (
        typeof fieldValue !== 'string' &&
        !(
          (field === 'companyName' || field === 'fullName') &&
          fieldValue === null
        )
      );
    })
  ) {
    throw new Error('Decrypted customer PII is invalid.');
  }

  return {
    companyName: value.companyName as string | null,
    fullName: value.fullName as string | null,
    phone: value.phone as string,
    email: value.email as string,
    address: value.address as string,
    postalCode: value.postalCode as string,
    city: value.city as string,
  };
}

export function parseDeviceInstallationAddress(
  value: unknown,
): DeviceInstallationAddress {
  if (
    !isRecord(value) ||
    typeof value.address !== 'string' ||
    typeof value.postalCode !== 'string' ||
    typeof value.city !== 'string'
  ) {
    throw new Error('Decrypted device installation address is invalid.');
  }

  return {
    address: value.address,
    postalCode: value.postalCode,
    city: value.city,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
