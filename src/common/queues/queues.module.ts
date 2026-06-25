import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsHandlersRegistry } from './jobs-handlers.registry';
import { JobsOidcGuard } from './jobs-oidc.guard';
import { QueueService } from './queue.service';

@Module({
  controllers: [JobsController],
  providers: [JobsHandlersRegistry, QueueService, JobsOidcGuard],
  exports: [JobsHandlersRegistry, QueueService],
})
export class QueuesModule {}
