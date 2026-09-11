import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum VisitSortBy {
  performedOn = 'performedOn',
  createdAt = 'createdAt',
}

export enum VisitSortDirection {
  asc = 'asc',
  desc = 'desc',
}

export class VisitsListQueryDto {
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

  @ApiPropertyOptional({ enum: VisitSortBy, default: VisitSortBy.performedOn })
  @IsOptional()
  @IsEnum(VisitSortBy)
  sortBy?: VisitSortBy;

  @ApiPropertyOptional({
    enum: VisitSortDirection,
    default: VisitSortDirection.desc,
  })
  @IsOptional()
  @IsEnum(VisitSortDirection)
  sortDirection?: VisitSortDirection;
}
