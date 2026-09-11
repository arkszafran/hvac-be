import type { ServiceOrdersListQueryDto } from '../../dto/service-orders-list-query.dto';

export class ListServiceOrdersQuery {
  constructor(
    public readonly tenantId: string,
    public readonly dto: ServiceOrdersListQueryDto,
  ) {}
}
