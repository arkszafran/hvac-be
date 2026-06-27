import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ValidateNested } from 'class-validator';

export class CreateTenantTenantDto {
  @ApiProperty({ example: 'HVAC Client Sp. z o.o.', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'Jan Kowalski', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  personName: string;

  @ApiProperty({ example: 'Dluga 1', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  street: string;

  @ApiProperty({ example: 'Warszawa', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  city: string;

  @ApiProperty({ example: '00-001', maxLength: 6 })
  @IsString()
  @MinLength(1)
  @MaxLength(6)
  zip: string;

  @ApiProperty({ example: '1234567890', maxLength: 10 })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  tax: string;
}

export class CreateTenantUserDto {
  @ApiProperty({ example: 'Anna Nowak', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'anna.nowak@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class CreateTenantDto {
  @ApiProperty({ type: CreateTenantTenantDto })
  @ValidateNested()
  @Type(() => CreateTenantTenantDto)
  tenant: CreateTenantTenantDto;

  @ApiProperty({ type: CreateTenantUserDto })
  @ValidateNested()
  @Type(() => CreateTenantUserDto)
  user: CreateTenantUserDto;
}
