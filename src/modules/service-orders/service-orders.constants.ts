import { ServiceOrderStatus } from '@generated/prisma/enums';

export const ACTIVE_INSPECTION_STATUSES = [
  ServiceOrderStatus.new,
  ServiceOrderStatus.contact_required,
  ServiceOrderStatus.scheduled,
] as const;

export const SERVICE_ORDERS_ERROR_CODES = {
  notFound: 'SERVICE_ORDER_NOT_FOUND',
  invalidInspection: 'INVALID_INSPECTION_SERVICE_ORDER',
  inspectionAlreadyAssigned: 'DEVICE_ACTIVE_INSPECTION_ALREADY_ASSIGNED',
  sharedInspectionConfirmationRequired:
    'SHARED_INSPECTION_CHANGE_CONFIRMATION_REQUIRED',
} as const;
