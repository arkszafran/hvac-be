import { ApiProperty } from '@nestjs/swagger';

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
