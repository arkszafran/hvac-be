import type {
  CustomerType,
  DeviceType,
  ServiceOrderSource,
  ServiceOrderStatus,
  ServiceOrderType,
} from '@generated/prisma/enums';

export type CustomerPii = {
  readonly companyName: string;
  readonly fullName: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
};

export type StoredCustomer = {
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

export type StoredCustomerMetadata = Pick<
  StoredCustomer,
  'id' | 'tenantId' | 'type' | 'createdAt' | 'updatedAt'
>;

export type StoredDevice = {
  readonly id: string;
  readonly customerId: string;
  readonly type: DeviceType;
  readonly brand: string;
  readonly model: string;
  readonly serialNumber: string | null;
  readonly installationDate: Date | null;
  readonly location: string | null;
  readonly hasCustomInstallationAddress: boolean;
  readonly installationAddressCiphertext: Buffer | null;
  readonly installationAddressNonce: Buffer | null;
  readonly installationAddressKeyVersion: number | null;
  readonly installationAddressFormatVersion: number | null;
};

export type StoredServiceOrder = {
  readonly id: string;
  readonly customerId: string;
  readonly type: ServiceOrderType;
  readonly source: ServiceOrderSource;
  readonly status: ServiceOrderStatus;
  readonly assigneeUserId: string | null;
  readonly orderDate: Date;
  readonly scheduledAt: Date | null;
  readonly nextContactAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deviceIds: readonly string[];
};

export type StoredCustomerDetails = {
  readonly customer: StoredCustomer;
  readonly devices: StoredDevice[];
  readonly serviceOrders: StoredServiceOrder[];
};

export function parseCustomerPii(value: unknown): CustomerPii {
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

  if (fields.some((field) => typeof value[field] !== 'string')) {
    throw new Error('Decrypted customer PII is invalid.');
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

export function parseInstallationAddress(value: unknown): {
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
} {
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
