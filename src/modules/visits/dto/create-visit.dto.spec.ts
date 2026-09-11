import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomerType, DeviceType, VisitType } from '@generated/prisma/enums';

import { CreateVisitDto } from './create-visit.dto';

describe('CreateVisitDto', () => {
  it('validates nested discriminated customer and device commands', async () => {
    const dto = plainToInstance(CreateVisitDto, {
      type: VisitType.inspection,
      performedOn: '2026-09-09',
      serviceOrderId: null,
      customer: {
        kind: 'create',
        customer: {
          type: CustomerType.individual,
          companyName: '',
          fullName: 'Jan Kowalski',
          phone: '500600700',
          email: 'jan@example.com',
          address: 'Długa 1',
          postalCode: '00-001',
          city: 'Warszawa',
        },
      },
      devices: [
        {
          kind: 'create',
          visitNote: '',
          device: {
            type: DeviceType.air_conditioning,
            brand: 123,
            model: 'X',
            powerKw: null,
            serialNumber: '',
            installationDate: '',
            warrantyMonths: 0,
            note: '',
            refrigerant: '',
            refrigerantAmount: '',
            location: '',
            hasCustomInstallationAddress: false,
            address: '',
            postalCode: '',
            city: '',
          },
        },
      ],
      nextInspection: null,
      attachments: [],
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'devices')).toBe(true);
  });

  it('rejects an unknown command discriminator and a missing nullable field', async () => {
    const dto = plainToInstance(CreateVisitDto, {
      type: VisitType.inspection,
      performedOn: '2026-09-09',
      serviceOrderId: null,
      customer: { kind: 'unknown' },
      devices: [
        {
          kind: 'existing',
          deviceId: '22222222-2222-4222-8222-222222222222',
          visitNote: '',
        },
      ],
      attachments: [],
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'customer')).toBe(true);
    expect(errors.some((error) => error.property === 'nextInspection')).toBe(
      true,
    );
  });

  it('rejects create commands without their nested payload', async () => {
    const dto = plainToInstance(CreateVisitDto, {
      type: VisitType.inspection,
      performedOn: '2026-09-09',
      serviceOrderId: null,
      customer: { kind: 'create' },
      devices: [{ kind: 'create', visitNote: '' }],
      nextInspection: null,
      attachments: [],
    });

    const errors = await validate(dto);
    const customerError = errors.find((error) => error.property === 'customer');
    const devicesError = errors.find((error) => error.property === 'devices');

    expect(customerError?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'customer' }),
      ]),
    );
    expect(devicesError?.children?.[0]?.children).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'device' })]),
    );
  });
});
