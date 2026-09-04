export const ENCRYPTION_ERROR_CODES = {
  invalidKey: 'ENCRYPTION_INVALID_KEY',
  invalidPayload: 'ENCRYPTION_INVALID_PAYLOAD',
  authenticationFailed: 'ENCRYPTION_AUTHENTICATION_FAILED',
  unsupportedFormat: 'ENCRYPTION_UNSUPPORTED_FORMAT',
  kmsUnavailable: 'ENCRYPTION_KMS_UNAVAILABLE',
  kmsIntegrityCheckFailed: 'ENCRYPTION_KMS_INTEGRITY_CHECK_FAILED',
  tenantKeyMissing: 'ENCRYPTION_TENANT_KEY_MISSING',
  tenantKeyStateInvalid: 'ENCRYPTION_TENANT_KEY_STATE_INVALID',
} as const;

export type EncryptionErrorCode =
  (typeof ENCRYPTION_ERROR_CODES)[keyof typeof ENCRYPTION_ERROR_CODES];

export class EncryptionError extends Error {
  override readonly name = 'EncryptionError';

  constructor(
    readonly code: EncryptionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
