import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { parseAllowedOrigins } from './common/http/request-origin';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { OriginInterceptor } from './common/interceptors/origin.interceptor';
import { EnvironmentVariables } from './config/env.validation';

export function configureApp(
  app: INestApplication,
  config: ConfigService<EnvironmentVariables, true>,
) {
  const http = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: unknown) => void;
  };
  http.set?.('trust proxy', 1);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new OriginInterceptor(config),
  );
  const allowedOrigins = parseAllowedOrigins(
    config.get('FRONTEND_ORIGIN', { infer: true }),
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });
}
