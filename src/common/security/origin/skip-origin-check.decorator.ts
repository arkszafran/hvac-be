import { SetMetadata } from '@nestjs/common';

import { SKIP_ORIGIN_CHECK_KEY } from './origin.constants';

export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_CHECK_KEY, true);
