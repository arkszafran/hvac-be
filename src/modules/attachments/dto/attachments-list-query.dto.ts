import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class AttachmentsListQueryDto {
  @ApiProperty({
    description:
      'Comma-separated attachment UUIDs returned by the upload request.',
    example:
      'c88d089a-fc15-4de0-a09c-8e7a359ec4d5,0c56dfb9-a90f-4eb0-b3f6-e3ce2887cbed',
  })
  @Transform(({ value }: { value: unknown }): unknown => {
    const values: unknown[] = Array.isArray(value)
      ? (value as unknown[])
      : [value];

    return values.flatMap((item): string[] => {
      if (typeof item !== 'string') {
        return [];
      }

      return item
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    });
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  ids: string[];
}
