# AGENTS.md

## Project stack

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- pnpm
- CQRS via `@nestjs/cqrs`

## Commands

- Install dependencies: `pnpm install`
- Start dev server: `pnpm start:dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Test: `pnpm test`
- Prisma generate: `pnpm prisma:generate`
- Prisma dev migration: `pnpm prisma:migrate:dev`
- Prisma deploy migration: `pnpm prisma:migrate:deploy`

## Core architecture rules

- Use feature-based modules.
- Avoid organizing code by global technical layers such as one shared `controllers/` directory for the whole app.
- Avoid circular dependencies.
- Prefer constructor injection.
- Do not use service locator patterns such as `ModuleRef.get()` unless explicitly justified.
- Keep controllers thin.
- Never put business logic in controllers.
- Always use CQRS for application logic.
- Every controller action must only validate/receive input and invoke a command or query.
- Write business logic inside command handlers or query handlers.
- Use events for decoupling between modules when direct dependencies would create tight coupling.
- Do not create god services.
- Keep each provider focused on one responsibility.
- On data model upgrade make changes only in `schema.prisma` then run command migrate:dev to create migration,
  you can modify migration file to create indexes only or other things not available form `schema.prisma`

## Module structure

Each feature module should follow this structure:

```txt
src/modules/<feature>/
  <feature>.module.ts

  controllers/
    <feature>.controller.ts

  commands/
    impl/
      create-<entity>.command.ts
      update-<entity>.command.ts
      delete-<entity>.command.ts
    handlers/
      create-<entity>.handler.ts
      update-<entity>.handler.ts
      delete-<entity>.handler.ts
    index.ts

  queries/
    impl/
      get-<entity>.query.ts
      list-<entities>.query.ts
    handlers/
      get-<entity>.handler.ts
      list-<entities>.handler.ts
    index.ts

  infrastructure/
    <feature>.repository.ts
    <feature>.read-repository.ts

  dto/
    create-<entity>.dto.ts
    update-<entity>.dto.ts
    <entity>-response.dto.ts
```

## Controllers

- Controllers must not contain business logic.
- Controllers must not access Prisma, repositories, or infrastructure services directly.
- Controllers must invoke `CommandBus.execute()` for state-changing operations.
- Controllers must invoke `QueryBus.execute()` for read operations.
- Controllers may map route params, query params, body DTOs, and current user context into commands or queries.
- Controllers must be annotated by swagger decorators
  Example:

```ts
@Post()
create(@Body() dto: CreateUserDto) {
  return this.commandBus.execute(new CreateUserCommand(dto));
}

@Get(':id')
findOne(@Param('id') id: string) {
  return this.queryBus.execute(new GetUserQuery(id));
}
```

## Commands

- Commands represent write operations.
- Commands must be immutable data containers.
- Commands must not contain business logic.
- Command handlers contain write-side application logic.
- Command handlers may call infrastructure repositories.
- Command handlers may emit domain/application events.
- Commands should be named with imperative intent, for example `CreateUserCommand`.
- Command response should be always created using `src\common\types\api-response.type.ts`

## Queries

- Queries represent read operations.
- Queries must be immutable data containers.
- Queries must not contain business logic.
- Query handlers contain read-side application logic.
- Query handlers may call read repositories or read models.
- Queries should never modify state.
- Queries should be named by intent, for example `GetUserByIdQuery`.
- Query response should be always created using `src\common\types\api-response.type.ts`

## Infrastructure

- Infrastructure contains data access only.
- Infrastructure services may use Prisma.
- Infrastructure may contain selects, inserts, updates, deletes, transactions, and database-specific mapping.
- Do not put business rules in infrastructure.
- Do not inject infrastructure services into controllers.
- Prefer repository-style classes over direct Prisma usage in handlers when queries are non-trivial.
- Keep Prisma-specific code isolated in infrastructure.

## Prisma rules

- Use `PrismaService` as the single Prisma client provider.
- Do not instantiate `PrismaClient` outside `PrismaService`.
- Use migrations for schema changes.
- Do not edit existing migration files unless explicitly requested.
- Use `pnpm prisma:migrate:deploy` during deployment.
- Use transactions for multi-step writes that must be atomic.
- Avoid N+1 queries.
- Use `select` and `include` intentionally.

## DTO and validation rules

- Use DTOs for request bodies.
- Use `class-validator` and `class-transformer`.
- Enable global `ValidationPipe`.
- Required validation config:

```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
```

- Never trust request input.
- Do not accept fields that are not defined in DTOs.

## Security rules

- Use `helmet`.
- Use CORS with explicit allowed origins in production.
- Use `@nestjs/throttler` for rate limiting.
- Use guards for authentication and authorization.
- Do not expose internal errors to clients.
- Do not log secrets, tokens, passwords, or sensitive personal data.
- Hash passwords with `bcrypt` or another approved password hashing library.
- Never store plain-text passwords.
- Keep JWT secrets and database URLs in environment variables.

## Error handling

- Throw NestJS HTTP exceptions for expected application errors.
- Use global exception filters for consistent error responses.
- Do not return raw Prisma errors to API consumers.
- Map database constraint errors to meaningful API errors.

## Testing rules

- Add unit tests for command handlers and query handlers.
- Mock infrastructure repositories in handler unit tests.
- Use e2e tests for important API flows.
- Do not test controllers for business logic because controllers should not contain business logic.
- Run `pnpm test` after meaningful logic changes when possible.

## Code style

- Use strict TypeScript.
- Avoid `any`.
- Prefer explicit return types for public methods.
- Use `async/await`.
- Prefer readonly properties where possible.
- Keep files small and focused.
- Preserve existing project conventions.

## Agent safety rules

- Do not commit secrets.
- Do not modify generated Prisma Client files.
- Do not modify migrations unless explicitly requested.
- Do not introduce new architectural patterns without explaining why.
- Before large refactors, inspect nearby code and follow existing conventions.

## Config

- Always use ConfigService to access to .env variables
- add validation of variables to `src/common/config/env.validation.ts`

## Guards

- Always import guards (AuthGuard, RoleAuthGuard, TenantGuard) using alias '@auth';
- Use @TenantId() to get tenantId, you can find it in src\common\security\auth\decorators\tenant-id.decorator.ts

## PII encryption in handlers

- Import `TenantEncryptionModule` into every module that handles Customer, ServiceOrder or Device PII. Inject `TenantPiiCipherService` into command and query handlers. Never call Google KMS, `TenantKeyService` or `AesGcmCipherService` directly.

- Always obtain `tenantId` from the authenticated context. Generate the record ID before encryption because `tenantId`, record ID, purpose and key version are protected by AAD.

- In create command handlers, build and validate the complete PII object, then encrypt it:

```ts
const encrypted = await this.piiCipher.encryptJson({
  tenantId,
  recordId,
  purpose: ENCRYPTION_PURPOSES.customerPii,
  value: {
    fullName,
    companyName,
    phone,
    email,
    address,
    postalCode,
    city,
  },
});

- Pass only encrypted fields to the repository:
{
  piiCiphertext: encrypted.ciphertext,
  piiNonce: encrypted.nonce,
  piiKeyVersion: encrypted.keyVersion,
  piiFormatVersion: encrypted.formatVersion,
}

- In query handlers, load the encrypted record through a tenant-scoped repository and decrypt it:
const value = await this.piiCipher.decryptJson({
  tenantId,
  recordId: row.id,
  purpose: ENCRYPTION_PURPOSES.customerPii,
  encrypted: {
    ciphertext: row.piiCiphertext,
    nonce: row.piiNonce,
    keyVersion: row.piiKeyVersion,
    formatVersion: row.piiFormatVersion,
  },
});

- In query handlers, load the encrypted record through a tenant-scoped repository and decrypt it:
const value = await this.piiCipher.decryptJson({
  tenantId,
  recordId: row.id,
  purpose: ENCRYPTION_PURPOSES.customerPii,
  encrypted: {
    ciphertext: row.piiCiphertext,
    nonce: row.piiNonce,
    keyVersion: row.piiKeyVersion,
    formatVersion: row.piiFormatVersion,
  },
});
```
