import { Logger, UnauthorizedException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { baleWebhookPathToken } from '../../modules/bale/webhook-secret';

describe('HttpExceptionFilter webhook redaction', () => {
  it('does not return the webhook secret path', () => {
    const token = baleWebhookPathToken('webhook-secret-value');
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: `/api/v1/bale/webhook/${token}?echo=1` }),
      }),
    };
    new HttpExceptionFilter().catch(
      new UnauthorizedException(`rejected /api/v1/bale/webhook/${token}`),
      host as never,
    );
    const body = json.mock.calls[0][0] as { path: string; message: string };
    expect(JSON.stringify(body)).not.toContain(token);
    expect(body.path).toBe('/api/v1/bale/webhook/[redacted]');
    expect(body.message).toBe('rejected /api/v1/bale/webhook/[redacted]');
    error.mockRestore();
  });
});
