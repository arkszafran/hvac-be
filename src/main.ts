import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AUTH_COOKIE_NAMES } from './modules/authentication/authentication.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const swaggerEnabled = getBooleanConfig(configService, 'SWAGGER_ON');

  app.use(
    helmet(
      swaggerEnabled
        ? {
            contentSecurityPolicy: {
              directives: {
                defaultSrc: [`'self'`],
                styleSrc: [`'self'`, `'unsafe-inline'`],
                imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
                scriptSrc: [`'self'`, `'unsafe-inline'`],
              },
            },
          }
        : undefined,
    ),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: getCorsOrigins(configService),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  setupSwagger(app, swaggerEnabled);

  await app.listen(configService.get<number>('PORT') ?? 3000);
}
void bootstrap();

function getCorsOrigins(configService: ConfigService): string[] {
  const allowedBrowserOrigins = configService.getOrThrow<string>(
    'ALLOWED_BROWSER_ORIGINS',
  );

  return allowedBrowserOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getBooleanConfig(configService: ConfigService, key: string): boolean {
  return ['true', '1', 'yes', 'on'].includes(
    configService.get<string>(key, '').trim().toLowerCase(),
  );
}

function setupSwagger(app: INestApplication, enabled: boolean): void {
  if (!enabled) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('HVAC API')
    .setDescription('HVAC backend API')
    .setVersion('1.0')
    .addTag('authentication')
    .addTag('users')
    .addCookieAuth(
      AUTH_COOKIE_NAMES.accessToken,
      undefined,
      AUTH_COOKIE_NAMES.accessToken,
    )
    .addCookieAuth(
      AUTH_COOKIE_NAMES.refreshToken,
      undefined,
      AUTH_COOKIE_NAMES.refreshToken,
    )
    .addCookieAuth(
      AUTH_COOKIE_NAMES.userId,
      undefined,
      AUTH_COOKIE_NAMES.userId,
    )
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('swagger', app, documentFactory, {
    customSiteTitle: 'HVAC API Docs',
  });
}
