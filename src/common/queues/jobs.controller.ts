import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SkipOriginCheck } from '../security/origin/skip-origin-check.decorator';
import { JobsHandlersRegistry } from './jobs-handlers.registry';
import { JobsOidcGuard } from './jobs-oidc.guard';
import { JobDto } from './jobs.dto';

@Controller('queues')
@UseGuards(JobsOidcGuard)
@SkipThrottle()
@SkipOriginCheck()
export class JobsController {
  constructor(private readonly registry: JobsHandlersRegistry) {}

  @Post('jobs')
  async handle(@Body() dto: JobDto): Promise<void> {
    const handler = this.registry.get(dto.type);

    await handler.handle(dto.payload);
  }
}
