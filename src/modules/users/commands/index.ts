import { ChangePasswordHandler } from './handlers/change-password.handler';
import { ChangePinHandler } from './handlers/change-pin.handler';
import { CreateTenantHandler } from './handlers/create-tenant.handler';
import { SetupNewUserCredentialsHandler } from './handlers/setup-new-user-credentials.handler';

export const UsersCommandHandlers = [
  CreateTenantHandler,
  SetupNewUserCredentialsHandler,
  ChangePasswordHandler,
  ChangePinHandler,
];

export * from './impl/change-password.command';
export * from './impl/change-pin.command';
export * from './impl/create-tenant.command';
export * from './impl/setup-new-user-credentials.command';
