import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { ServiceOrderStatus } from '@generated/prisma/enums';

import {
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import type { InspectionServiceOrderDto } from '../../dto/service-order-response.dto';
import { InspectionServiceOrderMapper } from '../../inspection-service-order.mapper';
import { ServiceOrdersReadRepository } from '../../infrastructure/service-orders.read-repository';
import { ACTIVE_INSPECTION_STATUSES } from '../../service-orders.constants';
import { TenantPiiCipherService } from '../../../tenant-encryption/tenant-pii-cipher.service';
import { ListInspectionServiceOrdersQuery } from '../impl/list-inspection-service-orders.query';

@QueryHandler(ListInspectionServiceOrdersQuery)
export class ListInspectionServiceOrdersHandler implements IQueryHandler<
  ListInspectionServiceOrdersQuery,
  ApiSuccessResponse<InspectionServiceOrderDto[]>
> {
  constructor(
    private readonly serviceOrdersReadRepository: ServiceOrdersReadRepository,
    private readonly mapper: InspectionServiceOrderMapper,
    private readonly piiCipher: TenantPiiCipherService,
  ) {}

  async execute(
    query: ListInspectionServiceOrdersQuery,
  ): Promise<ApiSuccessResponse<InspectionServiceOrderDto[]>> {
    const statuses = resolveStatuses(query.dto.statuses, query.dto.active);
    const orders = await this.serviceOrdersReadRepository.findInspections({
      tenantId: query.tenantId,
      customerId: query.dto.customerId,
      statuses,
      ...(query.dto.excludeDeviceId
        ? { excludeDeviceId: query.dto.excludeDeviceId }
        : {}),
    });

    return apiSuccess(
      await Promise.all(
        orders.map((order) => this.mapper.map(order, this.piiCipher)),
      ),
    );
  }
}

function resolveStatuses(
  statuses: string | undefined,
  active: string | undefined,
): ServiceOrderStatus[] {
  const requestedStatuses = statuses
    ? statuses.split(',').map((status) => status as ServiceOrderStatus)
    : [...ACTIVE_INSPECTION_STATUSES];

  if (active !== 'true') {
    return requestedStatuses;
  }

  const activeStatuses = new Set<ServiceOrderStatus>(
    ACTIVE_INSPECTION_STATUSES,
  );
  return requestedStatuses.filter((status) => activeStatuses.has(status));
}
