import { IsString, MinLength } from 'class-validator';

export class PinLoginDto {
  @IsString()
  @MinLength(4)
  pin: string;
}
