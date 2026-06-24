import { Body, Controller, Post } from '@nestjs/common';
import { JobsHandlersRegistry } from './jobs-handlers.registry';
import { JobDto } from './jobs.dto';

@Controller('queues')
export class JobsController {
  constructor(private readonly registry: JobsHandlersRegistry) {}

  @Post('jobs')
  async handle(@Body() dto: JobDto): Promise<void> {
    console.log('job received');
    const handler = this.registry.get(dto.type);

    await handler.handle(dto.payload);
  }
}
