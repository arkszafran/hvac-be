import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CustomerType, DeviceType, VisitType } from '@generated/prisma/enums';

import { AttachmentUploadFileDto } from '../../attachments/dto/attachment-upload-file.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateVisitCustomerDto {
  @ApiProperty({ enum: CustomerType })
  @IsEnum(CustomerType)
  type: CustomerType;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  companyName: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  fullName: string;

  @ApiProperty({ maxLength: 32 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone: string;

  @ApiProperty({ maxLength: 254 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address: string;

  @ApiProperty({ maxLength: 16 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  postalCode: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;
}

class VisitCustomerCommandBaseDto {
  @IsIn(['existing', 'create'])
  kind: 'existing' | 'create';
}

export class ExistingVisitCustomerCommandDto extends VisitCustomerCommandBaseDto {
  @ApiProperty({ enum: ['existing'] })
  declare kind: 'existing';

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  customerId: string;
}

export class CreateVisitCustomerCommandDto extends VisitCustomerCommandBaseDto {
  @ApiProperty({ enum: ['create'] })
  declare kind: 'create';

  @ApiProperty({ type: CreateVisitCustomerDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateVisitCustomerDto)
  customer: CreateVisitCustomerDto;
}

export type VisitCustomerCommandDto =
  | ExistingVisitCustomerCommandDto
  | CreateVisitCustomerCommandDto;

export class CreateVisitDeviceDataDto {
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

  @ApiProperty({ format: 'date' })
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

class VisitDeviceCommandBaseDto {
  @IsIn(['existing', 'create'])
  kind: 'existing' | 'create';
}

export class ExistingVisitDeviceCommandDto extends VisitDeviceCommandBaseDto {
  @ApiProperty({ enum: ['existing'] })
  declare kind: 'existing';

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  deviceId: string;

  @ApiProperty({ maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  visitNote: string;
}

export class CreateVisitDeviceCommandDto extends VisitDeviceCommandBaseDto {
  @ApiProperty({ enum: ['create'] })
  declare kind: 'create';

  @ApiProperty({ type: CreateVisitDeviceDataDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateVisitDeviceDataDto)
  device: CreateVisitDeviceDataDto;

  @ApiProperty({ maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  visitNote: string;
}

export type VisitDeviceCommandDto =
  | ExistingVisitDeviceCommandDto
  | CreateVisitDeviceCommandDto;

export class ScheduleNextInspectionDto {
  @ApiProperty({
    oneOf: [
      { type: 'string', format: 'date' },
      { type: 'string', format: 'date-time' },
    ],
  })
  @IsDateString()
  scheduledAt: string;
}

export class CreateVisitAttachmentDto extends AttachmentUploadFileDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  clientFileId: string;
}

@ApiExtraModels(
  ExistingVisitCustomerCommandDto,
  CreateVisitCustomerCommandDto,
  ExistingVisitDeviceCommandDto,
  CreateVisitDeviceCommandDto,
)
export class CreateVisitDto {
  @ApiProperty({ enum: VisitType })
  @IsEnum(VisitType)
  type: VisitType;

  @ApiProperty({ format: 'date', example: '2026-09-09' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  performedOn: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsUUID('4')
  serviceOrderId: string | null;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ExistingVisitCustomerCommandDto) },
      { $ref: getSchemaPath(CreateVisitCustomerCommandDto) },
    ],
    discriminator: { propertyName: 'kind' },
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => VisitCustomerCommandBaseDto, {
    discriminator: {
      property: 'kind',
      subTypes: [
        { name: 'existing', value: ExistingVisitCustomerCommandDto },
        { name: 'create', value: CreateVisitCustomerCommandDto },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  customer: VisitCustomerCommandDto;

  @ApiProperty({
    type: 'array',
    minItems: 1,
    items: {
      oneOf: [
        { $ref: getSchemaPath(ExistingVisitDeviceCommandDto) },
        { $ref: getSchemaPath(CreateVisitDeviceCommandDto) },
      ],
      discriminator: { propertyName: 'kind' },
    },
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VisitDeviceCommandBaseDto, {
    discriminator: {
      property: 'kind',
      subTypes: [
        { name: 'existing', value: ExistingVisitDeviceCommandDto },
        { name: 'create', value: CreateVisitDeviceCommandDto },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  devices: VisitDeviceCommandDto[];

  @ApiProperty({ type: ScheduleNextInspectionDto, nullable: true })
  @IsDefined()
  @ValidateIf((_object, value: unknown) => value !== null)
  @ValidateNested()
  @Type(() => ScheduleNextInspectionDto)
  nextInspection: ScheduleNextInspectionDto | null;

  @ApiProperty({ type: [CreateVisitAttachmentDto], maxItems: 10 })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateVisitAttachmentDto)
  attachments: CreateVisitAttachmentDto[];
}
