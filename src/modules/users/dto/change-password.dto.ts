import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPassword1', maxLength: 256 })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword: string;

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
