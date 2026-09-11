import type {
  AttachmentScanStatus,
  CustomerType,
  DeviceType,
  ServiceOrderSource,
  ServiceOrderStatus,
  ServiceOrderType,
  VisitType,
} from '@generated/prisma/enums';

export type VisitCustomerPii = {
  readonly companyName: string | null;
  readonly fullName: string | null;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
};

export type VisitInstallationAddress = {
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
};

export type StoredVisitCustomer = {
  readonly id: string;
  readonly tenantId: string;
  readonly type: CustomerType;
  readonly piiCiphertext: Buffer;
  readonly piiNonce: Buffer;
  readonly piiKeyVersion: number;
  readonly piiFormatVersion: number;
};

export type StoredVisitDevice = {
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
};

export type StoredVisitAttachment = {
  readonly id: string;
  readonly fileName: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly scanStatus: AttachmentScanStatus;
  readonly storageGeneration: string | null;
  readonly uploadExpiresAt: Date;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type StoredVisit = {
  readonly id: string;
  readonly tenantId: string;
  readonly serviceOrderId: string | null;
  readonly date: Date;
  readonly type: VisitType;
  readonly createdAt: Date;
  readonly user: {
    readonly id: string;
    readonly name: string;
  };
  readonly customer: StoredVisitCustomer;
  readonly devices: Array<{
    readonly note: string | null;
    readonly device: StoredVisitDevice;
  }>;
  readonly attachments: StoredVisitAttachment[];
};

export type StoredVisitServiceOrder = {
  readonly id: string;
  readonly customerId: string | null;
  readonly type: ServiceOrderType;
  readonly source: ServiceOrderSource;
  readonly status: ServiceOrderStatus;
  readonly assigneeUserId: string | null;
  readonly orderDate: Date;
  readonly scheduledAt: Date | null;
  readonly nextContactAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function parseVisitCustomerPii(value: unknown): VisitCustomerPii {
  if (!isRecord(value)) {
    throw new Error('Decrypted visit customer PII is invalid.');
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
    throw new Error('Decrypted visit customer PII is invalid.');
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

export function parseVisitInstallationAddress(
  value: unknown,
): VisitInstallationAddress {
  if (
    !isRecord(value) ||
    typeof value.address !== 'string' ||
    typeof value.postalCode !== 'string' ||
    typeof value.city !== 'string'
  ) {
    throw new Error('Decrypted visit device installation address is invalid.');
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
