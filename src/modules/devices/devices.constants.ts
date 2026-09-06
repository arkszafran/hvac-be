import { ServiceOrderStatus } from '@generated/prisma/enums';

export const ACTIVE_DEVICE_INSPECTION_STATUSES = [
  ServiceOrderStatus.new,
  ServiceOrderStatus.contact_required,
  ServiceOrderStatus.scheduled,
] as const;

export const DEVICES_ERROR_CODES = {
  notFound: 'DEVICE_NOT_FOUND',
  customerNotFound: 'DEVICE_CUSTOMER_NOT_FOUND',
  invalidCustomAddress: 'INVALID_DEVICE_INSTALLATION_ADDRESS',
  invalidInstallationDate: 'INVALID_DEVICE_INSTALLATION_DATE',
} as const;
