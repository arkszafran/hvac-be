import type { CreateVisitDto } from '../../dto/create-visit.dto';

export class CreateVisitCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly idempotencyKey: string,
    public readonly dto: CreateVisitDto,
  ) {}
}
