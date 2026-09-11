import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class ServiceOrderDetailsPathDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  serviceOrderId: string;
}

export class ServiceOrderDetailsQueryDto {
  @ApiPropertyOptional({ type: Boolean, default: false })
  @Type(() => String)
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  ommitAttachments?: boolean;
}
