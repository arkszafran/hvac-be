import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
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

  await app.listen(configService.get<number>('PORT') ?? 3000);
}
void bootstrap();

function getCorsOrigins(configService: ConfigService): string[] {
  const frontendOrigin = configService.getOrThrow<string>('FRONTEND_ORIGIN');

  return frontendOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
