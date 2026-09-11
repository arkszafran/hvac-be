import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ServiceOrderStatus, ServiceOrderType } from '@generated/prisma/enums';

export enum ServiceOrderSortBy {
  orderDate = 'orderDate',
  scheduledAt = 'scheduledAt',
  createdAt = 'createdAt',
  updatedAt = 'updatedAt',
}

export enum ServiceOrderSortDirection {
  asc = 'asc',
  desc = 'desc',
}

const toArray = ({ value }: { value: unknown }): unknown => {
  const entries = Array.isArray(value)
    ? (value as unknown[]).flatMap((entry) =>
        typeof entry === 'string' ? entry.split(',') : [entry],
      )
    : typeof value === 'string'
      ? value.split(',')
      : value;

  if (!Array.isArray(entries)) {
    return entries;
  }

  return (entries as unknown[]).map((entry) =>
    typeof entry === 'string' ? entry.trim() : entry,
  );
};

export class ServiceOrdersListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @ApiPropertyOptional({ enum: ServiceOrderType })
  @IsOptional()
  @IsEnum(ServiceOrderType)
  type?: ServiceOrderType;

  @ApiPropertyOptional({
    enum: ServiceOrderStatus,
    isArray: true,
    description:
      'May be repeated or supplied as one comma-separated query parameter.',
  })
  @Transform(toArray)
  @IsOptional()
  @IsArray()
  @IsEnum(ServiceOrderStatus, { each: true })
  statuses?: ServiceOrderStatus[];

  @ApiPropertyOptional({
    type: Boolean,
    deprecated: true,
    description:
      'Legacy filter restricting inspection orders to active statuses.',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: string;

  @ApiPropertyOptional({ format: 'uuid', deprecated: true })
  @IsOptional()
  @IsUUID('4')
  excludeDeviceId?: string;

  @ApiPropertyOptional({
    description: 'Case- and diacritic-insensitive search phrase.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({
    enum: ServiceOrderSortBy,
    default: ServiceOrderSortBy.orderDate,
  })
  @IsOptional()
  @IsEnum(ServiceOrderSortBy)
  sortBy?: ServiceOrderSortBy;

  @ApiPropertyOptional({
    enum: ServiceOrderSortDirection,
    default: ServiceOrderSortDirection.desc,
  })
  @IsOptional()
  @IsEnum(ServiceOrderSortDirection)
  sortDirection?: ServiceOrderSortDirection;
}
