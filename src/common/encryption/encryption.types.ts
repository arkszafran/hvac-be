export const ENCRYPTION_PURPOSES = {
  customerPii: 'customer-pii',
  serviceOrderCustomerSnapshot: 'service-order-customer-snapshot',
  deviceInstallationAddress: 'device-installation-address',
} as const;

export type EncryptionPurpose =
  (typeof ENCRYPTION_PURPOSES)[keyof typeof ENCRYPTION_PURPOSES];

export type EncryptionContext = {
  readonly tenantId: string;
  readonly purpose: EncryptionPurpose;
  readonly recordId: string;
  readonly keyVersion: number;
  readonly formatVersion: number;
};

export type EncryptedPayload = {
  readonly ciphertext: Buffer;
  readonly nonce: Buffer;
  readonly keyVersion: number;
  readonly formatVersion: number;
};

export type WrappedTenantDek = {
  readonly tenantId: string;
  readonly version: number;
  readonly wrappedDek: Buffer;
  readonly kekKeyName: string;
  readonly kekKeyVersion: string;
};
