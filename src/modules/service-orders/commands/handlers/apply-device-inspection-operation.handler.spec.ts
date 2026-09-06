import { ConflictException } from '@nestjs/common';
import { CustomerType, ServiceOrderStatus } from '@generated/prisma/enums';

import type { InspectionOperationContext } from '../../service-orders.types';
import { ApplyDeviceInspectionOperationCommand } from '../impl/apply-device-inspection-operation.command';
import { ApplyDeviceInspectionOperationHandler } from './apply-device-inspection-operation.handler';

jest.mock('../../infrastructure/service-orders.repository', () => ({
  ServiceOrdersRepository: jest.fn(),
}));

describe('ApplyDeviceInspectionOperationHandler', () => {
  const transaction = { transaction: true };
  const context: InspectionOperationContext = {
    tenantId: 'tenant-1',
    customerId: 'customer-1',
    customerType: CustomerType.individual,
    deviceId: 'device-1',
  };

  it('creates an inspection using only customer and device relations', async () => {
    const repository = createRepositoryMock();
    repository.findActiveInspectionIdForDevice.mockResolvedValue(null);
    const handler = new ApplyDeviceInspectionOperationHandler(
      repository as unknown as ConstructorParameters<
        typeof ApplyDeviceInspectionOperationHandler
      >[0],
    );

    await handler.execute(
      new ApplyDeviceInspectionOperationCommand(
        context,
        {
          action: 'create_inspection',
          scheduledAt: '2027-02-20T08:00:00.000Z',
        },
        transaction as never,
      ),
    );

    expect(repository.createInspection).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: context.tenantId,
        customerId: context.customerId,
        customerType: context.customerType,
        deviceId: context.deviceId,
        scheduledAt: new Date('2027-02-20T08:00:00.000Z'),
      }),
      transaction,
    );
  });

  it('deletes an inspection after detaching its last device', async () => {
    const repository = createRepositoryMock();
    repository.findInspectionForMutation.mockResolvedValue({
      id: 'order-1',
      customerId: context.customerId,
      status: ServiceOrderStatus.scheduled,
      deviceIds: [context.deviceId],
    });
    repository.countDevices.mockResolvedValue(0);
    const handler = new ApplyDeviceInspectionOperationHandler(
      repository as unknown as ConstructorParameters<
        typeof ApplyDeviceInspectionOperationHandler
      >[0],
    );

    await handler.execute(
      new ApplyDeviceInspectionOperationCommand(
        context,
        { action: 'detach_inspection', serviceOrderId: 'order-1' },
        transaction as never,
      ),
    );

    expect(repository.detachDevice).toHaveBeenCalledWith(
      'order-1',
      context.deviceId,
      transaction,
    );
    expect(repository.deleteInspection).toHaveBeenCalledWith(
      context.tenantId,
      'order-1',
      transaction,
    );
  });

  it('requires confirmation before rescheduling a shared inspection', async () => {
    const repository = createRepositoryMock();
    repository.findInspectionForMutation.mockResolvedValue({
      id: 'order-1',
      customerId: context.customerId,
      status: ServiceOrderStatus.scheduled,
      deviceIds: [context.deviceId, 'device-2'],
    });
    const handler = new ApplyDeviceInspectionOperationHandler(
      repository as unknown as ConstructorParameters<
        typeof ApplyDeviceInspectionOperationHandler
      >[0],
    );

    await expect(
      handler.execute(
        new ApplyDeviceInspectionOperationCommand(
          context,
          {
            action: 'reschedule_inspection',
            serviceOrderId: 'order-1',
            scheduledAt: '2027-03-01T09:00:00.000Z',
            confirmSharedOrderChange: false,
          },
          transaction as never,
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.rescheduleInspection).not.toHaveBeenCalled();
  });
});

function createRepositoryMock() {
  return {
    findInspectionForMutation: jest.fn(),
    findActiveInspectionIdForDevice: jest.fn(),
    createInspection: jest.fn(),
    attachDevice: jest.fn(),
    detachDevice: jest.fn(),
    countDevices: jest.fn(),
    deleteInspection: jest.fn(),
    rescheduleInspection: jest.fn(),
  };
}
