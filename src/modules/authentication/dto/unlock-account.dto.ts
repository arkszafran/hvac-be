import { IsString, IsUUID, MinLength } from 'class-validator';

export class UnlockAccountDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MinLength(16)
  code: string;
}
