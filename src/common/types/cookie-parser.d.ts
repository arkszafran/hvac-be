declare module 'cookie-parser' {
  function cookieParser(
    secret?: string | string[],
    options?: Record<string, unknown>,
  ): import('express').RequestHandler;

  export = cookieParser;
}
