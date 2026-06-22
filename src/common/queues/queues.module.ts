import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsHandlersRegistry } from './jobs-handlers.registry';

@Module({
  controllers: [JobsController],
  providers: [JobsHandlersRegistry],
  exports: [JobsHandlersRegistry],
})
export class QueuesModule {}
