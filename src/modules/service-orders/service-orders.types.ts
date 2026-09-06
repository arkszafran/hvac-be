import type {
  CustomerType,
  MessageConfirmationStatus,
  ServiceOrderSource,
  ServiceOrderStatus,
} from '@generated/prisma/enums';

export type ServiceOrderCustomerPii = {
  readonly companyName: string;
  readonly fullName: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
};

export type ServiceOrderInstallationAddress = {
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
};

export type StoredInspectionAddress = {
  readonly hasCustomInstallationAddress: boolean;
  readonly installationAddressCiphertext: Buffer | null;
  readonly installationAddressNonce: Buffer | null;
  readonly installationAddressKeyVersion: number | null;
  readonly installationAddressFormatVersion: number | null;
};

export type StoredRelatedInspectionDevice = StoredInspectionAddress & {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
};

export type StoredInspectionCustomer = {
  readonly id: string;
  readonly tenantId: string;
  readonly piiCiphertext: Buffer;
  readonly piiNonce: Buffer;
  readonly piiKeyVersion: number;
  readonly piiFormatVersion: number;
};

export type StoredInspectionServiceOrder = {
  readonly id: string;
  readonly tenantId: string;
  readonly customerId: string;
  readonly customer: StoredInspectionCustomer;
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
  readonly devices: StoredRelatedInspectionDevice[];
};

export type InspectionOperationContext = {
  readonly tenantId: string;
  readonly customerId: string;
  readonly customerType: CustomerType;
  readonly deviceId: string;
};

export type DeviceInspectionOperation =
  | {
      readonly action: 'create_inspection';
      readonly scheduledAt: string;
    }
  | {
      readonly action: 'attach_inspection';
      readonly serviceOrderId: string;
    }
  | {
      readonly action: 'detach_inspection';
      readonly serviceOrderId: string;
    }
  | {
      readonly action: 'reschedule_inspection';
      readonly serviceOrderId: string;
      readonly scheduledAt: string;
      readonly confirmSharedOrderChange: boolean;
    }
  | {
      readonly action: 'move_to_new_inspection';
      readonly currentServiceOrderId: string;
      readonly scheduledAt: string;
    };

export function parseServiceOrderCustomerPii(
  value: unknown,
): ServiceOrderCustomerPii {
  if (!isRecord(value)) {
    throw new Error('Decrypted service order customer PII is invalid.');
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

  if (fields.some((field) => typeof value[field] !== 'string')) {
    throw new Error('Decrypted service order customer PII is invalid.');
  }

  return {
    companyName: value.companyName as string,
    fullName: value.fullName as string,
    phone: value.phone as string,
    email: value.email as string,
    address: value.address as string,
    postalCode: value.postalCode as string,
    city: value.city as string,
  };
}

export function parseServiceOrderInstallationAddress(
  value: unknown,
): ServiceOrderInstallationAddress {
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
