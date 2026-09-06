import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { DeviceType } from '@generated/prisma/enums';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class DeviceWriteDto {
  @ApiProperty({ enum: DeviceType })
  @IsEnum(DeviceType)
  type: DeviceType;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  brand: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  model: string;

  @ApiProperty({ type: Number, nullable: true, minimum: 0 })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(99999.999)
  powerKw: number | null;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  serialNumber: string;

  @ApiProperty({ format: 'date', example: '2026-08-20' })
  @IsString()
  @ValidateIf((_object, value: unknown) => value !== '')
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  installationDate: string;

  @ApiProperty({ minimum: 0, maximum: 600 })
  @IsInt()
  @Min(0)
  @Max(600)
  warrantyMonths: number;

  @ApiProperty({ maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  note: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  refrigerant: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  refrigerantAmount: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  location: string;

  @ApiProperty()
  @IsBoolean()
  hasCustomInstallationAddress: boolean;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address: string;

  @ApiProperty({ maxLength: 16 })
  @Transform(trim)
  @IsString()
  @MaxLength(16)
  postalCode: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  city: string;
}
