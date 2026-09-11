import {
  CustomerType,
  DeviceType,
  ServiceOrderSource,
  ServiceOrderStatus,
  ServiceOrderType,
  VisitType,
} from '@generated/prisma/enums';
import { createHash } from 'node:crypto';

import { CreateVisitCommand } from '../impl/create-visit.command';
import { CreateVisitHandler } from './create-visit.handler';

jest.mock('../../infrastructure/visits.repository', () => ({
  VisitsRepository: jest.fn(),
}));
jest.mock('../../../attachments/infrastructure/attachments.repository', () => ({
  AttachmentsRepository: jest.fn(),
}));
jest.mock('../../../customers/infrastructure/customers.repository', () => ({
  CustomersRepository: jest.fn(),
}));
jest.mock(
  '../../../customers/infrastructure/customers.read-repository',
  () => ({ CustomersReadRepository: jest.fn() }),
);
jest.mock('../../../devices/infrastructure/devices.repository', () => ({
  DevicesRepository: jest.fn(),
}));
jest.mock('../../../devices/infrastructure/devices.read-repository', () => ({
  DevicesReadRepository: jest.fn(),
}));
jest.mock('../../visits.mapper', () => ({ VisitsMapper: jest.fn() }));
jest.mock('../../../tenant-encryption/tenant-pii-cipher.service', () => ({
  TenantPiiCipherService: jest.fn(),
}));
jest.mock('../../../attachments/attachment-upload.service', () => ({
  AttachmentUploadService: jest.fn(),
}));

describe('CreateVisitHandler', () => {
  it('persists the visit, completes its order and creates the next inspection in one transaction', async () => {
    const customerId = '11111111-1111-4111-8111-111111111111';
    const deviceId = '22222222-2222-4222-8222-222222222222';
    const serviceOrderId = '33333333-3333-4333-8333-333333333333';
    const idempotencyKey = '44444444-4444-4444-8444-444444444444';
    const expectedVisitId = deriveExpectedUuid(
      'tenant-1',
      `${idempotencyKey}:visit`,
    );
    const customer = { id: customerId, type: CustomerType.individual };
    const device = { id: deviceId, customerId };
    const visit = { id: idempotencyKey, attachments: [] };
    const baseOrder = {
      id: serviceOrderId,
      customerId,
      type: ServiceOrderType.repair,
      source: ServiceOrderSource.user,
      status: ServiceOrderStatus.scheduled,
      assigneeUserId: null,
      orderDate: new Date('2026-09-01T10:00:00.000Z'),
      scheduledAt: null as Date | null,
      nextContactAt: null,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    };
    const completedOrder = {
      ...baseOrder,
      status: ServiceOrderStatus.completed,
    };
    const nextOrder = {
      ...baseOrder,
      id: 'next-order',
      type: ServiceOrderType.inspection,
      source: ServiceOrderSource.system,
      status: ServiceOrderStatus.new,
      scheduledAt: new Date('2027-09-09T08:00:00.000Z'),
    };
    const transaction = {};
    const repository = {
      transaction: jest.fn((work: (transaction: object) => Promise<unknown>) =>
        work(transaction),
      ),
      findVisitById: jest.fn().mockResolvedValue(null),
      findServiceOrderForCompletion: jest.fn().mockResolvedValue(baseOrder),
      createVisit: jest.fn().mockResolvedValue(visit),
      completeServiceOrder: jest.fn().mockResolvedValue(completedOrder),
      createNextInspection: jest.fn().mockResolvedValue(nextOrder),
    };
    const attachmentsRepository = {
      createPendingMany: jest.fn().mockResolvedValue([]),
    };
    const customersRepository = {
      hasEmailLookupHash: jest.fn(),
      create: jest.fn(),
    };
    const customersReadRepository = {
      findById: jest.fn().mockResolvedValue(customer),
    };
    const devicesRepository = { create: jest.fn() };
    const devicesReadRepository = {
      findById: jest.fn().mockResolvedValue(device),
    };
    const mapper = {
      mapVisit: jest.fn().mockResolvedValue({ id: idempotencyKey }),
      mapServiceOrder: jest.fn((order: typeof baseOrder) => ({
        ...order,
        orderDate: order.orderDate.toISOString(),
        scheduledAt: order.scheduledAt?.toISOString() ?? null,
        nextContactAt: null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      })),
      mapPendingAttachment: jest.fn(),
    };
    const handler = new CreateVisitHandler(
      repository as never,
      attachmentsRepository as never,
      customersRepository as never,
      customersReadRepository as never,
      devicesRepository as never,
      devicesReadRepository as never,
      mapper as never,
      { encryptJson: jest.fn() } as never,
      { create: jest.fn() } as never,
      {
        preparePendingAttachments: jest.fn().mockReturnValue([]),
        createUploadForms: jest.fn().mockResolvedValue([]),
      } as never,
    );

    const result = await handler.execute(
      new CreateVisitCommand('tenant-1', 'user-1', idempotencyKey, {
        type: VisitType.repair,
        performedOn: '2026-09-09',
        serviceOrderId,
        customer: { kind: 'existing', customerId },
        devices: [{ kind: 'existing', deviceId, visitNote: 'Naprawiono' }],
        nextInspection: { scheduledAt: '2027-09-09T08:00:00.000Z' },
        attachments: [],
      }),
    );

    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(customersReadRepository.findById).toHaveBeenCalledWith(
      'tenant-1',
      customerId,
      transaction,
    );
    expect(devicesReadRepository.findById).toHaveBeenCalledWith(
      'tenant-1',
      deviceId,
      transaction,
    );
    expect(repository.createVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expectedVisitId,
        tenantId: 'tenant-1',
        customerId,
        userId: 'user-1',
        serviceOrderId,
        devices: [{ deviceId, note: 'Naprawiono', sortOrder: 0 }],
      }),
      transaction,
    );
    expect(attachmentsRepository.createPendingMany).toHaveBeenCalledWith(
      [],
      transaction,
    );
    expect(repository.completeServiceOrder).toHaveBeenCalledWith(
      'tenant-1',
      serviceOrderId,
      transaction,
    );
    expect(repository.createNextInspection).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        customerId,
        customerType: CustomerType.individual,
        deviceIds: [deviceId],
        scheduledAt: new Date('2027-09-09T08:00:00.000Z'),
      }),
      transaction,
    );
    expect(result.data.completedServiceOrder?.status).toBe(
      ServiceOrderStatus.completed,
    );
    expect(result.data.nextInspectionServiceOrder).toEqual(
      expect.objectContaining({
        type: ServiceOrderType.inspection,
        source: ServiceOrderSource.system,
        status: ServiceOrderStatus.new,
      }),
    );
  });

  it('creates customers and devices through their owning repositories in the visit transaction', async () => {
    const transaction = {};
    const repository = {
      transaction: jest.fn((work: (transaction: object) => Promise<unknown>) =>
        work(transaction),
      ),
      findVisitById: jest.fn().mockResolvedValue(null),
      createVisit: jest.fn((input: { readonly id: string }) =>
        Promise.resolve({ id: input.id, attachments: [] }),
      ),
    };
    const attachmentsRepository = {
      createPendingMany: jest.fn().mockResolvedValue([]),
    };
    const customersRepository = {
      hasEmailLookupHash: jest.fn().mockResolvedValue(false),
      create: jest.fn(
        (input: {
          readonly id: string;
          readonly tenantId: string;
          readonly type: CustomerType;
        }) =>
          Promise.resolve({
            id: input.id,
            tenantId: input.tenantId,
            type: input.type,
          }),
      ),
    };
    const customersReadRepository = { findById: jest.fn() };
    const devicesRepository = {
      create: jest.fn(
        (input: {
          readonly id: string;
          readonly tenantId: string;
          readonly customerId: string;
        }) =>
          Promise.resolve({
            id: input.id,
            tenantId: input.tenantId,
            customerId: input.customerId,
          }),
      ),
    };
    const devicesReadRepository = { findById: jest.fn() };
    const mapper = {
      mapVisit: jest.fn().mockResolvedValue({ id: 'visit-1' }),
      mapServiceOrder: jest.fn(),
      mapPendingAttachment: jest.fn(),
    };
    const encryptedPayload = {
      ciphertext: Buffer.from('ciphertext'),
      nonce: Buffer.from('nonce'),
      keyVersion: 1,
      formatVersion: 1,
    };
    const piiCipher = {
      encryptJson: jest.fn().mockResolvedValue(encryptedPayload),
    };
    const emailLookup = {
      create: jest.fn().mockReturnValue({
        hash: Buffer.from('email-hash'),
        keyVersion: 1,
      }),
    };
    const handler = new CreateVisitHandler(
      repository as never,
      attachmentsRepository as never,
      customersRepository as never,
      customersReadRepository as never,
      devicesRepository as never,
      devicesReadRepository as never,
      mapper as never,
      piiCipher as never,
      emailLookup as never,
      {
        preparePendingAttachments: jest.fn().mockReturnValue([]),
        createUploadForms: jest.fn().mockResolvedValue([]),
      } as never,
    );

    await handler.execute(
      new CreateVisitCommand(
        'tenant-1',
        'user-1',
        '55555555-5555-4555-8555-555555555555',
        {
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
              visitNote: 'Pierwszy przegląd',
              device: {
                type: DeviceType.air_conditioning,
                brand: 'Daikin',
                model: 'Perfera',
                powerKw: 3.5,
                serialNumber: 'SN-1',
                installationDate: '2026-09-01',
                warrantyMonths: 24,
                note: '',
                refrigerant: 'R32',
                refrigerantAmount: '0.8 kg',
                location: 'Salon',
                hasCustomInstallationAddress: false,
                address: '',
                postalCode: '',
                city: '',
              },
            },
          ],
          nextInspection: null,
          attachments: [],
        },
      ),
    );

    expect(customersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        type: CustomerType.individual,
      }),
      transaction,
    );
    const customerInput = customersRepository.create.mock.calls[0][0];

    expect(devicesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        customerId: customerInput.id,
        brand: 'Daikin',
        model: 'Perfera',
      }),
      transaction,
    );
    expect(customersReadRepository.findById).not.toHaveBeenCalled();
    expect(devicesReadRepository.findById).not.toHaveBeenCalled();
  });
});

function deriveExpectedUuid(namespace: string, name: string): string {
  const bytes = createHash('sha256')
    .update(namespace, 'utf8')
    .update('\0', 'utf8')
    .update(name, 'utf8')
    .digest()
    .subarray(0, 16);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
