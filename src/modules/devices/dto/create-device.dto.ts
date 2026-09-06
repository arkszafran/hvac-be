import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { DeviceWriteDto } from './device-write.dto';

export enum CreateDeviceServiceOrderAction {
  createInspection = 'create_inspection',
  attachInspection = 'attach_inspection',
}

export class CreateDeviceServiceOrderCommandDto {
  @ApiProperty({ enum: CreateDeviceServiceOrderAction })
  @IsEnum(CreateDeviceServiceOrderAction)
  action: CreateDeviceServiceOrderAction;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf(
    (dto: CreateDeviceServiceOrderCommandDto) =>
      dto.action === CreateDeviceServiceOrderAction.createInspection,
  )
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(
    (dto: CreateDeviceServiceOrderCommandDto) =>
      dto.action === CreateDeviceServiceOrderAction.attachInspection,
  )
  @IsUUID('4')
  serviceOrderId?: string;
}

export class CreateDeviceDto extends DeviceWriteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  customerId: string;

  @ApiPropertyOptional({ type: CreateDeviceServiceOrderCommandDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDeviceServiceOrderCommandDto)
  serviceOrder?: CreateDeviceServiceOrderCommandDto;
}
