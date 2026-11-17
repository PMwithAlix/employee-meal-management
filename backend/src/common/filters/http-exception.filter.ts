import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
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
