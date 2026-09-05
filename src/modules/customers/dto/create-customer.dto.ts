import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CustomerType } from '@generated/prisma/enums';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCustomerDto {
  @ApiProperty({ enum: CustomerType, example: CustomerType.company })
  @IsEnum(CustomerType)
  type: CustomerType;

  @ApiProperty({ example: 'Klimat Sp. z o.o.', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  companyName: string;

  @ApiProperty({ example: 'Jan Kowalski', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName: string;

  @ApiProperty({ example: '+48 500 600 700', maxLength: 32 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone: string;

  @ApiProperty({ example: 'jan.kowalski@example.com', maxLength: 254 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'ul. Długa 1', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address: string;

  @ApiProperty({ example: '00-001', maxLength: 16 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  postalCode: string;

  @ApiProperty({ example: 'Warszawa', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;
}
