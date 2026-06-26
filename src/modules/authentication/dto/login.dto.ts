import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'correct-horse-battery-staple', maxLength: 256 })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password: string;
}
