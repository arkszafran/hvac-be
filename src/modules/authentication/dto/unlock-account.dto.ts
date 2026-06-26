import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UnlockAccountDto {
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
}
