import { Queue } from './queues.enum';

export class JobDto {
  type: Queue;
  payload: unknown;
}
