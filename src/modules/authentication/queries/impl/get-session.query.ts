import type { RequestWithCookies } from '../../authentication.types';

export class GetSessionQuery {
  constructor(public readonly request: RequestWithCookies) {}
}
