import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ServiceOrderType } from '@generated/prisma/enums';

const normalizeStatuses = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((status) => status.trim())
        .filter(Boolean)
        .join(',')
    : value;

export class ServiceOrdersQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  customerId: string;

  @ApiProperty({ enum: [ServiceOrderType.inspection] })
  @Equals(ServiceOrderType.inspection)
  type: typeof ServiceOrderType.inspection;

  @ApiPropertyOptional({
    example: 'new,contact_required,scheduled',
    description: 'Comma-separated service order statuses.',
  })
  @Transform(normalizeStatuses)
  @IsOptional()
  @IsString()
  @Matches(
    /^(new|contact_required|scheduled|completed|cancelled)(,(new|contact_required|scheduled|completed|cancelled))*$/,
  )
  statuses?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Restricts results to active inspection statuses.',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  excludeDeviceId?: string;
}
