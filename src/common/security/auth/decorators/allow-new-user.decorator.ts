import { SetMetadata } from '@nestjs/common';

export const ALLOW_NEW_USER_KEY = 'auth:allow-new-user';

export const AllowNewUser = () => SetMetadata(ALLOW_NEW_USER_KEY, true);
