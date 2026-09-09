import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum CustomersSortBy {
  displayName = 'displayName',
  createdAt = 'createdAt',
}

export enum SortDirection {
  asc = 'asc',
  desc = 'desc',
}

export class CustomersQueryDto {
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

  @ApiPropertyOptional({ enum: CustomersSortBy })
  @IsOptional()
  @IsEnum(CustomersSortBy)
  sortBy?: CustomersSortBy;

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.asc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection;
}
