export const VISITS_ERROR_CODES = {
  customerNotFound: 'VISIT_CUSTOMER_NOT_FOUND',
  customerEmailAlreadyExists: 'VISIT_CUSTOMER_EMAIL_ALREADY_EXISTS',
  deviceNotFound: 'VISIT_DEVICE_NOT_FOUND',
  deviceCustomerMismatch: 'VISIT_DEVICE_CUSTOMER_MISMATCH',
  invalidDeviceAddress: 'VISIT_DEVICE_ADDRESS_INVALID',
  invalidInstallationDate: 'VISIT_DEVICE_INSTALLATION_DATE_INVALID',
  duplicateDevice: 'VISIT_DEVICE_DUPLICATED',
  serviceOrderNotFound: 'VISIT_SERVICE_ORDER_NOT_FOUND',
  serviceOrderCustomerMismatch: 'VISIT_SERVICE_ORDER_CUSTOMER_MISMATCH',
  attachmentRequestInvalid: 'VISIT_ATTACHMENT_REQUEST_INVALID',
  duplicateClientFileId: 'VISIT_ATTACHMENT_CLIENT_FILE_ID_DUPLICATED',
  idempotencyKeyReused: 'VISIT_IDEMPOTENCY_KEY_REUSED',
} as const;
