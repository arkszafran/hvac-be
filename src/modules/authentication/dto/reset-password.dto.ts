import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'd22d4b60-89aa-4feb-ac6b-21235bf1cd85' })
  @IsUUID()
  userId: string;

  @ApiProperty({
    example: 'ZMTmFtYzzx77MhEF6VEOGJWHu5GHwsX93pWKunGmbc8',
    minLength: 16,
    maxLength: 128,
  })
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  code: string;

  @ApiProperty({
    example: 'NewPassword1',
    minLength: 8,
    maxLength: 256,
    description: 'Must contain at least one uppercase letter and one digit.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  @Matches(/[A-Z]/, {
    message: 'password must contain at least one uppercase letter',
  })
  @Matches(/[0-9]/, {
    message: 'password must contain at least one digit',
  })
  password: string;
}
