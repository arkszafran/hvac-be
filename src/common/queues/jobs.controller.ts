import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JobsHandlersRegistry } from './jobs-handlers.registry';
import { JobsOidcGuard } from './jobs-oidc.guard';
import { JobDto } from './jobs.dto';

@Controller('queues')
@UseGuards(JobsOidcGuard)
export class JobsController {
  constructor(private readonly registry: JobsHandlersRegistry) {}

  @Post('jobs')
  async handle(@Body() dto: JobDto): Promise<void> {
    const handler = this.registry.get(dto.type);

    await handler.handle(dto.payload);
  }
}
