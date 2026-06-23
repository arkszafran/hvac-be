import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class PinLoginDto {
  @ApiProperty({ example: '1234', minLength: 4 })
  @IsString()
  @MinLength(4)
  pin: string;
}
