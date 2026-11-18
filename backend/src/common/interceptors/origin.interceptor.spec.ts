import { ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { NodeEnv } from '../../config/env.validation';
import { baleWebhookPathToken } from '../../modules/bale/webhook-secret';
import { OriginInterceptor } from './origin.interceptor';

function context(url: string, headers: Record<string, string> = {}) {
  const request = { method: 'POST', url, originalUrl: url, headers };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

function interceptor() {
  return new OriginInterceptor({
    get: (key: string) => {
      if (key === 'NODE_ENV') return NodeEnv.Production;
      if (key === 'FRONTEND_ORIGIN') return 'https://food.kavosh.site';
      return undefined;
    },
  } as never);
}

describe('OriginInterceptor', () => {
  const next = { handle: () => of(true) };

  it('rejects other POST endpoints without Origin in production', () => {
    expect(() =>
      interceptor().intercept(context('/api/v1/orders') as never, next),
    ).toThrow(ForbiddenException);
  });

  it('allows the Bale webhook without Origin in production', () => {
    const token = baleWebhookPathToken('webhook-secret-value');
    expect(() =>
      interceptor().intercept(context(`/api/v1/bale/webhook/${token}`) as never, next),
    ).not.toThrow();
  });

  it('does not exempt the old webhook path that has no secret segment', () => {
    expect(() =>
      interceptor().intercept(context('/api/v1/bale/webhook') as never, next),
    ).toThrow(ForbiddenException);
  });

  it('still rejects the Bale webhook when Origin is hostile', () => {
    const token = baleWebhookPathToken('webhook-secret-value');
    expect(() =>
      interceptor().intercept(
        context(`/api/v1/bale/webhook/${token}`, { origin: 'https://evil.example' }) as never,
        next,
      ),
    ).toThrow(ForbiddenException);
  });
});
