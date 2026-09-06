import type { ServiceOrdersTransactionClient } from '../../infrastructure/service-orders.repository';
import type {
  DeviceInspectionOperation,
  InspectionOperationContext,
} from '../../service-orders.types';

export class ApplyDeviceInspectionOperationCommand {
  constructor(
    public readonly context: InspectionOperationContext,
    public readonly operation: DeviceInspectionOperation,
    public readonly transaction: ServiceOrdersTransactionClient,
  ) {}
}
