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
import {
  baleWebhookOriginAllowed,
  isAllowedRequestOrigin,
  isBaleWebhookRequest,
  parseAllowedOrigins,
  shouldSkipOriginGuard,
} from '../http/request-origin';

@Injectable()
export class OriginInterceptor implements NestInterceptor {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const allowed = parseAllowedOrigins(
      this.config.get('FRONTEND_ORIGIN', { infer: true }),
    );
    const origin = Array.isArray(request.headers.origin)
      ? request.headers.origin[0]
      : request.headers.origin;

    if (isBaleWebhookRequest(request)) {
      if (!baleWebhookOriginAllowed(origin, request, allowed)) {
        throw new ForbiddenException('Origin نامعتبر است.');
      }
      return next.handle();
    }

    if (shouldSkipOriginGuard(request)) {
      return next.handle();
    }

    if (!origin) {
      const env = this.config.get('NODE_ENV', { infer: true });
      if (env === NodeEnv.Production) {
        throw new ForbiddenException('Origin نامعتبر است.');
      }
      return next.handle();
    }

    if (!isAllowedRequestOrigin(origin, request, allowed)) {
      throw new ForbiddenException('Origin نامعتبر است.');
    }
    return next.handle();
  }
}
