import type { ServiceOrdersQueryDto } from '../../dto/service-orders-query.dto';

export class ListInspectionServiceOrdersQuery {
  constructor(
    public readonly tenantId: string,
    public readonly dto: ServiceOrdersQueryDto,
  ) {}
}
