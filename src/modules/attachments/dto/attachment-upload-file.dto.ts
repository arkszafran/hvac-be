import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ATTACHMENTS_ALLOWED_CONTENT_TYPES } from '../attachments.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AttachmentUploadFileDto {
  @ApiProperty({
    description:
      'Display name shown to the user. It is not used as the Cloud Storage object key.',
    example: 'jednostka-zewnetrzna.jpg',
    maxLength: 255,
  })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  @ApiProperty({
    description: 'MIME type reported by File.type in the browser.',
    enum: ATTACHMENTS_ALLOWED_CONTENT_TYPES,
    example: 'image/jpeg',
  })
  @IsString()
  @IsIn(ATTACHMENTS_ALLOWED_CONTENT_TYPES)
  contentType: string;

  @ApiProperty({
    description: 'Exact File.size value in bytes.',
    example: 3145728,
    minimum: 1,
    maximum: 10485760,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes: number;

  @ApiPropertyOptional({
    description: 'Optional user-visible description.',
    example: 'Widok tabliczki znamionowej',
    maxLength: 1000,
    nullable: true,
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}
