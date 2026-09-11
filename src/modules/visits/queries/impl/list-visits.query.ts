import type { VisitsListQueryDto } from '../../dto/visits-list-query.dto';

export class ListVisitsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly dto: VisitsListQueryDto,
  ) {}
}
