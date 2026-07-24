import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus, UserTenantRole } from '@generated/prisma/enums';

export class AuthenticationSuccessResponseDto {
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

export class AuthenticationSessionTenantDto {
  @ApiProperty({ example: 'd22d4b60-89aa-4feb-ac6b-21235bf1cd85' })
  id: string;

  @ApiProperty({ example: 'Acme HVAC' })
  name: string;

  @ApiProperty({ enum: UserTenantRole, example: UserTenantRole.ADMIN })
  role: UserTenantRole;
}

export class AuthenticationSessionUserDto {
  @ApiProperty({ example: '7cfa926e-8a69-4f59-9d1d-363eb59cf51d' })
  id: string;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.TENANT_USER })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.active })
  status: UserStatus;

  @ApiProperty({ type: [AuthenticationSessionTenantDto] })
  tenants: AuthenticationSessionTenantDto[];
}

export class AuthenticationSessionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AuthenticationSessionUserDto })
  data: AuthenticationSessionUserDto;
}

export class AuthenticationErrorDto {
  @ApiProperty({ example: 'INVALID_CREDENTIALS' })
  code: string;

  @ApiProperty({ example: 'Invalid credentials.' })
  message: string;

  @ApiProperty({
    type: 'object',
    example: null,
    nullable: true,
    additionalProperties: true,
  })
  details: null | Record<string, unknown>;
}

export class AuthenticationErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ type: AuthenticationErrorDto })
  error: AuthenticationErrorDto;
}

export class AuthenticationRedirectErrorDetailsDto {
  @ApiProperty({ example: 'http://localhost:4200/pin-login' })
  redirectTo: string;
}

export class AuthenticationRedirectErrorDto {
  @ApiProperty({ example: 'PIN_REQUIRED' })
  code: string;

  @ApiProperty({ example: 'PIN login is required.' })
  message: string;

  @ApiProperty({ type: AuthenticationRedirectErrorDetailsDto })
  details: AuthenticationRedirectErrorDetailsDto;
}

export class AuthenticationRedirectErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ type: AuthenticationRedirectErrorDto })
  error: AuthenticationRedirectErrorDto;
}

export class LoginRetriesLimitReachedErrorDto {
  @ApiProperty({ example: 'LOGIN_RETRIES_LIMIT_REACHED' })
  code: string;

  @ApiProperty({ example: 'Login retries limit reached.' })
  message: string;

  @ApiProperty({
    type: 'object',
    example: null,
    nullable: true,
    additionalProperties: false,
  })
  details: null;
}

export class LoginRetriesLimitReachedResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ type: LoginRetriesLimitReachedErrorDto })
  error: LoginRetriesLimitReachedErrorDto;
}
