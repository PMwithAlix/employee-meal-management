import { Logger } from '@nestjs/common';
import { of } from 'rxjs';
import { baleWebhookPathToken } from '../../modules/bale/webhook-secret';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor webhook redaction', () => {
  it('logs a successful webhook without the secret segment', (done) => {
    const token = baleWebhookPathToken('webhook-secret-value');
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const request = {
      method: 'POST',
      originalUrl: `/api/v1/bale/webhook/${token}?unused=1`,
    };
    const response = { statusCode: 200 };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    new LoggingInterceptor()
      .intercept(context as never, { handle: () => of(true) })
      .subscribe({
        complete: () => {
          const line = log.mock.calls.flat().join(' ');
          expect(line).toContain('POST /api/v1/bale/webhook/[redacted] 200');
          expect(line).not.toContain(token);
          log.mockRestore();
          done();
        },
      });
  });
});
