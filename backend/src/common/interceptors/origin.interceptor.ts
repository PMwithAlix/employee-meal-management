import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { EnvironmentVariables, NodeEnv } from '../../config/env.validation';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class OriginInterceptor implements NestInterceptor {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();
    if (
      SAFE_METHODS.has(method) ||
      (request.originalUrl ?? request.url).includes('/health')
    ) {
      return next.handle();
    }

    const allowed = this.config.get('FRONTEND_ORIGIN', { infer: true });
    const origin = request.headers.origin;
    if (!origin) {
      const env = this.config.get('NODE_ENV', { infer: true });
      if (env === NodeEnv.Production) {
        throw new ForbiddenException('Origin نامعتبر است.');
      }
      return next.handle();
    }

    if (origin !== allowed) {
      throw new ForbiddenException('Origin نامعتبر است.');
    }
    return next.handle();
  }
}
