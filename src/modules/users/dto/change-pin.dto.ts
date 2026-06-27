import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePinDto {
  @ApiProperty({ example: 'CurrentPassword1', maxLength: 256 })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword: string;

  @ApiProperty({ example: '1234', minLength: 4, maxLength: 32 })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  pin: string;
}
