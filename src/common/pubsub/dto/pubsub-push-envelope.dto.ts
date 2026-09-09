import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PubSubPushMessageDto {
  @ApiProperty({
    description: 'Base64-encoded message payload.',
    example: 'eyJidWNrZXQiOiJleGFtcGxlLWJ1Y2tldCJ9',
  })
  @IsString()
  @MinLength(1)
  data: string;

  @ApiPropertyOptional({
    description: 'Attributes published together with the message.',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @ApiProperty({ example: '12345678901234567' })
  @IsString()
  @MinLength(1)
  messageId: string;

  @ApiPropertyOptional({
    description: 'Legacy alias sometimes included by Pub/Sub.',
    example: '12345678901234567',
  })
  @IsOptional()
  @IsString()
  message_id?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  publishTime?: string;

  @ApiPropertyOptional({
    description: 'Legacy alias sometimes included by Pub/Sub.',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601()
  publish_time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderingKey?: string;
}

export class PubSubPushEnvelopeDto {
  @ApiProperty({ type: PubSubPushMessageDto })
  @ValidateNested()
  @Type(() => PubSubPushMessageDto)
  message: PubSubPushMessageDto;

  @ApiProperty({
    example:
      'projects/hvac-attachments-dev/subscriptions/attachment-file-events-local',
  })
  @IsString()
  @MinLength(1)
  subscription: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deliveryAttempt?: number;
}
