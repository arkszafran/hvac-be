import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
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

export enum UpdateDeviceServiceOrderAction {
  createInspection = 'create_inspection',
  attachInspection = 'attach_inspection',
  detachInspection = 'detach_inspection',
  rescheduleInspection = 'reschedule_inspection',
  moveToNewInspection = 'move_to_new_inspection',
}

export class UpdateDeviceServiceOrderCommandDto {
  @ApiProperty({ enum: UpdateDeviceServiceOrderAction })
  @IsEnum(UpdateDeviceServiceOrderAction)
  action: UpdateDeviceServiceOrderAction;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((dto: UpdateDeviceServiceOrderCommandDto) =>
    [
      UpdateDeviceServiceOrderAction.attachInspection,
      UpdateDeviceServiceOrderAction.detachInspection,
    ].includes(dto.action),
  )
  @IsUUID('4')
  serviceOrderId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((dto: UpdateDeviceServiceOrderCommandDto) =>
    [
      UpdateDeviceServiceOrderAction.rescheduleInspection,
      UpdateDeviceServiceOrderAction.moveToNewInspection,
    ].includes(dto.action),
  )
  @IsUUID('4')
  currentServiceOrderId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((dto: UpdateDeviceServiceOrderCommandDto) =>
    [
      UpdateDeviceServiceOrderAction.createInspection,
      UpdateDeviceServiceOrderAction.rescheduleInspection,
      UpdateDeviceServiceOrderAction.moveToNewInspection,
    ].includes(dto.action),
  )
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateDeviceDto extends PartialType(DeviceWriteDto) {
  @ApiPropertyOptional({ type: UpdateDeviceServiceOrderCommandDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateDeviceServiceOrderCommandDto)
  serviceOrder?: UpdateDeviceServiceOrderCommandDto;
}
