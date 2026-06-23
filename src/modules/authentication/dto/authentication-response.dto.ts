import { ApiProperty } from '@nestjs/swagger';

export class AuthenticationSuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

export class AuthenticationRedirectResponseDto {
  @ApiProperty({ example: 'PIN_REQUIRED' })
  reason: string;

  @ApiProperty({ example: 'http://localhost:4200/pin-login' })
  redirectTo: string;
}

export class AuthenticationUnauthorizedResponseDto {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({ example: 'Invalid credentials.' })
  message: string;

  @ApiProperty({ example: 'Unauthorized' })
  error: string;
}

export class LoginRetriesLimitReachedResponseDto {
  @ApiProperty({ example: 'LOGIN_RETRIES_LIMIT_REACHED' })
  code: string;

  @ApiProperty({ example: 'Login retries limit reached.' })
  message: string;
}
