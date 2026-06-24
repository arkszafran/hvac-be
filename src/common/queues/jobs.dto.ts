import { ApiProperty } from '@nestjs/swagger';
import { Allow, IsDefined, IsEnum } from 'class-validator';

import { Queue } from './queues.enum';

export class JobDto {
  @ApiProperty({ enum: Queue })
  @IsEnum(Queue)
  type: Queue;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  @IsDefined()
  @Allow()
  payload: unknown;
}
