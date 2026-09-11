import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { apiError } from '../../../../common/types/api-response.type';
import type {
  CreateVisitCustomerDto,
  CreateVisitDeviceDataDto,
} from '../../dto/create-visit.dto';
import { VISITS_ERROR_CODES } from '../../visits.constants';
import type { CreateVisitCommand } from '../impl/create-visit.command';

export function ensureUniqueVisitDeviceIds(
  devices: ReadonlyArray<{ readonly id: string }>,
): void {
  const ids = new Set(devices.map((device) => device.id));

  if (ids.size !== devices.length) {
    throw new BadRequestException(
      apiError({
        code: VISITS_ERROR_CODES.duplicateDevice,
        message: 'Each device can occur in a visit only once.',
      }),
    );
  }
}

export function ensureUniqueClientFileIds(
  attachments: ReadonlyArray<{ readonly clientFileId: string }>,
): void {
  const clientIds = new Set(
    attachments.map((attachment) => attachment.clientFileId),
  );

  if (clientIds.size !== attachments.length) {
    throw new BadRequestException(
      apiError({
        code: VISITS_ERROR_CODES.duplicateClientFileId,
        message: 'Each attachment clientFileId must be unique.',
      }),
    );
  }
}

export function normalizeAndValidateAddress(input: {
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
}): {
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
} {
  const address = {
    address: input.address.trim(),
    postalCode: input.postalCode.trim(),
    city: input.city.trim(),
  };

  if (!address.address || !address.postalCode || !address.city) {
    throw new BadRequestException(
      apiError({
        code: VISITS_ERROR_CODES.invalidDeviceAddress,
        message: 'A complete custom installation address is required.',
      }),
    );
  }

  return address;
}

export function deriveCommandUuid(
  command: Pick<CreateVisitCommand, 'tenantId' | 'idempotencyKey'>,
  name: string,
): string {
  return deriveUuid(command.tenantId, `${command.idempotencyKey}:${name}`);
}

export function fingerprintCustomer(customer: CreateVisitCustomerDto): string {
  return JSON.stringify({
    type: customer.type,
    companyName: customer.companyName,
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    postalCode: customer.postalCode,
    city: customer.city,
  });
}

export function fingerprintDevice(device: CreateVisitDeviceDataDto): string {
  return JSON.stringify({
    type: device.type,
    brand: device.brand,
    model: device.model,
    powerKw: device.powerKw,
    serialNumber: device.serialNumber,
    installationDate: device.installationDate,
    warrantyMonths: device.warrantyMonths,
    note: device.note,
    refrigerant: device.refrigerant,
    refrigerantAmount: device.refrigerantAmount,
    location: device.location,
    hasCustomInstallationAddress: device.hasCustomInstallationAddress,
    address: device.address,
    postalCode: device.postalCode,
    city: device.city,
  });
}

export function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

export function throwCustomerNotFound(): never {
  throw new NotFoundException(
    apiError({
      code: VISITS_ERROR_CODES.customerNotFound,
      message: 'Visit customer was not found.',
    }),
  );
}

export function throwCustomerEmailAlreadyExists(): never {
  throw new ConflictException(
    apiError({
      code: VISITS_ERROR_CODES.customerEmailAlreadyExists,
      message: 'Customer with this email already exists.',
    }),
  );
}

export function throwDeviceNotFound(deviceId: string): never {
  throw new NotFoundException(
    apiError({
      code: VISITS_ERROR_CODES.deviceNotFound,
      message: 'Visit device was not found.',
      details: { deviceId },
    }),
  );
}

export function throwDeviceCustomerMismatch(deviceId: string): never {
  throw new BadRequestException(
    apiError({
      code: VISITS_ERROR_CODES.deviceCustomerMismatch,
      message: 'Every visit device must belong to the visit customer.',
      details: { deviceId },
    }),
  );
}

export function throwServiceOrderNotFound(): never {
  throw new NotFoundException(
    apiError({
      code: VISITS_ERROR_CODES.serviceOrderNotFound,
      message: 'Service order was not found.',
    }),
  );
}

export function throwServiceOrderCustomerMismatch(): never {
  throw new BadRequestException(
    apiError({
      code: VISITS_ERROR_CODES.serviceOrderCustomerMismatch,
      message: 'Service order must belong to the visit customer.',
    }),
  );
}

export function throwInvalidInstallationDate(): never {
  throw new BadRequestException(
    apiError({
      code: VISITS_ERROR_CODES.invalidInstallationDate,
      message: 'Installation date is required when warranty is enabled.',
    }),
  );
}

export function throwIdempotencyKeyReused(): never {
  throw new ConflictException(
    apiError({
      code: VISITS_ERROR_CODES.idempotencyKeyReused,
      message: 'Idempotency key was already used for a different request.',
    }),
  );
}

function deriveUuid(namespace: string, name: string): string {
  const bytes = createHash('sha256')
    .update(namespace, 'utf8')
    .update('\0', 'utf8')
    .update(name, 'utf8')
    .digest()
    .subarray(0, 16);

  // Deterministic while remaining compatible with the API's UUID v4 pipes.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
