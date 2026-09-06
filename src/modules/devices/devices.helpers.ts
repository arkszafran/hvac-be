import { BadRequestException } from '@nestjs/common';

import { apiError } from '../../common/types/api-response.type';
import { DEVICES_ERROR_CODES } from './devices.constants';
import type { DeviceInstallationAddress } from './devices.types';

export function normalizeAndValidateAddress(input: {
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
}): DeviceInstallationAddress {
  const address = {
    address: input.address.trim(),
    postalCode: input.postalCode.trim(),
    city: input.city.trim(),
  };

  if (!address.address || !address.postalCode || !address.city) {
    throw new BadRequestException(
      apiError({
        code: DEVICES_ERROR_CODES.invalidCustomAddress,
        message: 'A complete custom installation address is required.',
      }),
    );
  }

  return address;
}

export type CustomInstallationAddressUpdate =
  | { readonly action: 'preserve' }
  | { readonly action: 'clear' }
  | {
      readonly action: 'replace';
      readonly value: DeviceInstallationAddress;
    };

export function resolveCustomInstallationAddressUpdate(
  hasCustomInstallationAddress: boolean,
  hadCustomInstallationAddress: boolean,
  input: {
    readonly address?: string;
    readonly postalCode?: string;
    readonly city?: string;
  },
): CustomInstallationAddressUpdate {
  if (!hasCustomInstallationAddress) {
    return { action: 'clear' };
  }

  const hasAddressFields =
    input.address !== undefined ||
    input.postalCode !== undefined ||
    input.city !== undefined;

  if (!hasAddressFields && hadCustomInstallationAddress) {
    return { action: 'preserve' };
  }

  return {
    action: 'replace',
    value: normalizeAndValidateAddress({
      address: input.address ?? '',
      postalCode: input.postalCode ?? '',
      city: input.city ?? '',
    }),
  };
}
