import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDataDto {
  @ApiProperty({ example: 'd22d4b60-89aa-4feb-ac6b-21235bf1cd85' })
  tenantId: string;

  @ApiProperty({ example: '7cfa926e-8a69-4f59-9d1d-363eb59cf51d' })
  userId: string;
}

export class CreateTenantResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: CreateTenantDataDto })
  data: CreateTenantDataDto;
}

export class UsersSuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    type: 'object',
    example: null,
    nullable: true,
    additionalProperties: false,
  })
  data: null;
}

export class UsersErrorDto {
  @ApiProperty({ example: 'INVALID_CURRENT_PASSWORD' })
  code: string;

  @ApiProperty({ example: 'Current password is invalid.' })
  message: string;

  @ApiProperty({
    type: 'object',
    example: null,
    nullable: true,
    additionalProperties: true,
  })
  details: null | Record<string, unknown>;
}

export class UsersErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ type: UsersErrorDto })
  error: UsersErrorDto;
}
