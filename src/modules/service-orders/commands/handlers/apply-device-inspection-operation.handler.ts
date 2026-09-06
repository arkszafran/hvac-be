import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import type { ServiceOrderStatus } from '@generated/prisma/enums';

import { apiError } from '../../../../common/types/api-response.type';
import {
  ServiceOrdersRepository,
  type InspectionForMutation,
  type ServiceOrdersTransactionClient,
} from '../../infrastructure/service-orders.repository';
import {
  ACTIVE_INSPECTION_STATUSES,
  SERVICE_ORDERS_ERROR_CODES,
} from '../../service-orders.constants';
import type { InspectionOperationContext } from '../../service-orders.types';
import { ApplyDeviceInspectionOperationCommand } from '../impl/apply-device-inspection-operation.command';

@CommandHandler(ApplyDeviceInspectionOperationCommand)
export class ApplyDeviceInspectionOperationHandler implements ICommandHandler<
  ApplyDeviceInspectionOperationCommand,
  void
> {
  constructor(private readonly repository: ServiceOrdersRepository) {}

  async execute(command: ApplyDeviceInspectionOperationCommand): Promise<void> {
    const { context, operation, transaction } = command;

    switch (operation.action) {
      case 'create_inspection':
        await this.createInspection(
          context,
          operation.scheduledAt,
          transaction,
        );
        break;
      case 'attach_inspection':
        await this.attachInspection(
          context,
          operation.serviceOrderId,
          transaction,
        );
        break;
      case 'detach_inspection':
        await this.detachInspection(
          context,
          operation.serviceOrderId,
          transaction,
        );
        break;
      case 'reschedule_inspection':
        await this.rescheduleInspection(context, operation, transaction);
        break;
      case 'move_to_new_inspection':
        await this.moveToNewInspection(context, operation, transaction);
        break;
    }
  }

  private async createInspection(
    context: InspectionOperationContext,
    scheduledAt: string,
    transaction: ServiceOrdersTransactionClient,
  ): Promise<void> {
    await this.ensureDeviceHasNoOtherActiveInspection(
      context.tenantId,
      context.deviceId,
      transaction,
    );

    const serviceOrderId = randomUUID();

    await this.repository.createInspection(
      {
        id: serviceOrderId,
        tenantId: context.tenantId,
        customerId: context.customerId,
        customerType: context.customerType,
        deviceId: context.deviceId,
        scheduledAt: new Date(scheduledAt),
        now: new Date(),
      },
      transaction,
    );
  }

  private async attachInspection(
    context: InspectionOperationContext,
    serviceOrderId: string,
    transaction: ServiceOrdersTransactionClient,
  ): Promise<void> {
    const inspection = await this.getValidInspection(
      context,
      serviceOrderId,
      transaction,
    );

    if (inspection.deviceIds.includes(context.deviceId)) {
      return;
    }

    await this.ensureDeviceHasNoOtherActiveInspection(
      context.tenantId,
      context.deviceId,
      transaction,
      serviceOrderId,
    );
    await this.repository.attachDevice(
      serviceOrderId,
      context.deviceId,
      inspection.deviceIds.length,
      transaction,
    );
  }

  private async detachInspection(
    context: InspectionOperationContext,
    serviceOrderId: string,
    transaction: ServiceOrdersTransactionClient,
  ): Promise<void> {
    const inspection = await this.getValidInspection(
      context,
      serviceOrderId,
      transaction,
    );
    this.ensureDeviceAttached(inspection, context.deviceId);

    await this.repository.detachDevice(
      serviceOrderId,
      context.deviceId,
      transaction,
    );

    if (
      (await this.repository.countDevices(serviceOrderId, transaction)) === 0
    ) {
      await this.repository.deleteInspection(
        context.tenantId,
        serviceOrderId,
        transaction,
      );
    }
  }

  private async rescheduleInspection(
    context: InspectionOperationContext,
    input: {
      readonly serviceOrderId: string;
      readonly scheduledAt: string;
      readonly confirmSharedOrderChange: boolean;
    },
    transaction: ServiceOrdersTransactionClient,
  ): Promise<void> {
    const inspection = await this.getValidInspection(
      context,
      input.serviceOrderId,
      transaction,
    );
    this.ensureDeviceAttached(inspection, context.deviceId);

    if (inspection.deviceIds.length > 1 && !input.confirmSharedOrderChange) {
      throw new ConflictException(
        apiError({
          code: SERVICE_ORDERS_ERROR_CODES.sharedInspectionConfirmationRequired,
          message:
            'Changing the date affects other devices assigned to this inspection.',
          details: { deviceCount: inspection.deviceIds.length },
        }),
      );
    }

    await this.repository.rescheduleInspection(
      context.tenantId,
      input.serviceOrderId,
      new Date(input.scheduledAt),
      transaction,
    );
  }

  private async moveToNewInspection(
    context: InspectionOperationContext,
    input: {
      readonly currentServiceOrderId: string;
      readonly scheduledAt: string;
    },
    transaction: ServiceOrdersTransactionClient,
  ): Promise<void> {
    await this.detachInspection(
      context,
      input.currentServiceOrderId,
      transaction,
    );
    await this.createInspection(context, input.scheduledAt, transaction);
  }

  private async getValidInspection(
    context: InspectionOperationContext,
    serviceOrderId: string,
    transaction: ServiceOrdersTransactionClient,
  ): Promise<InspectionForMutation> {
    const inspection = await this.repository.findInspectionForMutation(
      context.tenantId,
      serviceOrderId,
      transaction,
    );

    if (!inspection) {
      throw new NotFoundException(
        apiError({
          code: SERVICE_ORDERS_ERROR_CODES.notFound,
          message: 'Service order was not found.',
        }),
      );
    }

    if (
      inspection.customerId !== context.customerId ||
      !new Set<ServiceOrderStatus>(ACTIVE_INSPECTION_STATUSES).has(
        inspection.status,
      )
    ) {
      throw new BadRequestException(
        apiError({
          code: SERVICE_ORDERS_ERROR_CODES.invalidInspection,
          message:
            'Service order must be an active inspection of the device customer.',
        }),
      );
    }

    return inspection;
  }

  private ensureDeviceAttached(
    inspection: InspectionForMutation,
    deviceId: string,
  ): void {
    if (!inspection.deviceIds.includes(deviceId)) {
      throw new BadRequestException(
        apiError({
          code: SERVICE_ORDERS_ERROR_CODES.invalidInspection,
          message: 'Device is not assigned to this inspection.',
        }),
      );
    }
  }

  private async ensureDeviceHasNoOtherActiveInspection(
    tenantId: string,
    deviceId: string,
    transaction: ServiceOrdersTransactionClient,
    excludedServiceOrderId?: string,
  ): Promise<void> {
    const assignedInspectionId =
      await this.repository.findActiveInspectionIdForDevice(
        tenantId,
        deviceId,
        ACTIVE_INSPECTION_STATUSES,
        transaction,
        excludedServiceOrderId,
      );

    if (assignedInspectionId) {
      throw new ConflictException(
        apiError({
          code: SERVICE_ORDERS_ERROR_CODES.inspectionAlreadyAssigned,
          message: 'Device already has an active inspection.',
          details: { serviceOrderId: assignedInspectionId },
        }),
      );
    }
  }
}
