import { BadRequestException } from '@nestjs/common';

import { resolveCustomInstallationAddressUpdate } from './devices.helpers';

describe('resolveCustomInstallationAddressUpdate', () => {
  it('does not use another address when enabling a custom address', () => {
    expect(() =>
      resolveCustomInstallationAddressUpdate(true, false, {}),
    ).toThrow(BadRequestException);
  });

  it('uses an explicitly provided custom address', () => {
    expect(
      resolveCustomInstallationAddressUpdate(true, false, {
        address: ' Instalacyjna 1 ',
        postalCode: ' 00-001 ',
        city: ' Warszawa ',
      }),
    ).toEqual({
      action: 'replace',
      value: {
        address: 'Instalacyjna 1',
        postalCode: '00-001',
        city: 'Warszawa',
      },
    });
  });

  it('clears the custom address when it is disabled', () => {
    expect(
      resolveCustomInstallationAddressUpdate(false, true, {
        address: 'Adres klienta 1',
        postalCode: '00-001',
        city: 'Warszawa',
      }),
    ).toEqual({ action: 'clear' });
  });

  it('does not fill missing address fields with stored values', () => {
    expect(() =>
      resolveCustomInstallationAddressUpdate(true, true, {
        city: 'Kraków',
      }),
    ).toThrow(BadRequestException);
  });

  it('preserves encrypted data when the whole address is omitted', () => {
    expect(resolveCustomInstallationAddressUpdate(true, true, {})).toEqual({
      action: 'preserve',
    });
  });
});
