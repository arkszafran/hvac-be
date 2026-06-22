import { Injectable } from '@nestjs/common';
import { Queue } from './queues.enum';
export type JobHandler<TPayload = unknown> = {
  handle(payload: TPayload): Promise<unknown>;
};

@Injectable()
export class JobsHandlersRegistry {
  private readonly handlers = new Map<Queue, JobHandler>();

  register(type: Queue, handler: JobHandler) {
    if (this.handlers.has(type)) {
      throw new Error(`Job handler already registered: ${type}`);
    }

    this.handlers.set(type, handler);
  }

  get(type: Queue): JobHandler {
    const handler = this.handlers.get(type);

    if (!handler) {
      throw new Error(`No job handler registered for type: ${type}`);
    }

    return handler;
  }
}
