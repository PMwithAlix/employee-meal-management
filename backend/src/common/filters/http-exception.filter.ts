import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ensureRequestId,
  isBaleLoginRequest,
  wasBaleLoginDiagnosed,
} from '../http/request-id';
import {
  classifyUnhandledBaleLoginError,
  diagnosticUsernameNormalized,
  emitBaleLoginDiagnostic,
  initDataPresence,
} from '../../modules/bale/bale-login-diagnostics';
import { redactWebhookPath, redactWebhookPaths } from '../../modules/bale/webhook-secret';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const body =
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      !Array.isArray(exceptionResponse)
        ? (exceptionResponse as Record<string, unknown>)
        : {
            message:
              typeof exceptionResponse === 'string'
                ? exceptionResponse
                : 'Internal server error',
          };

    if (!(exception instanceof HttpException)) {
      const detail =
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception);
      this.logger.error(redactWebhookPath(detail));
    }

    if (isBaleLoginRequest(request) && !wasBaleLoginDiagnosed(request)) {
      ensureRequestId(request);
      const body = request.body as { initData?: unknown; username?: unknown } | undefined;
      const presence = initDataPresence(body?.initData);
      const classified = classifyUnhandledBaleLoginError(exception);
      emitBaleLoginDiagnostic(this.logger, request, {
        status,
        category: classified.category,
        initDataPresent: presence.initDataPresent,
        initDataLength: presence.initDataLength,
        reachedAuthLogin: false,
        authResult: classified.authResult,
        usernameNormalized: diagnosticUsernameNormalized(body?.username),
        reason: classified.reason,
      });
    }

    response.status(status).json(
      redactWebhookPaths({
        ...body,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url ?? '',
      }),
    );
  }
}
