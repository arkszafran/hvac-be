import { Controller } from '@nestjs/common';
import { JobsHandlersRegistry } from './jobs-handlers.registry';
import { JobDto } from './jobs.dto';

@Controller('queues/jobs')
export class JobsController {
  constructor(private readonly registry: JobsHandlersRegistry) {}

  async handle(dto: JobDto): Promise<void> {
    const handler = this.registry.get(dto.type);

    await handler.handle(dto.payload);
  }
}
