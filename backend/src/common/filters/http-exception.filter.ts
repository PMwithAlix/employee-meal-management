import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      ...body,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
