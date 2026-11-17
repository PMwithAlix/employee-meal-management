import type { Request } from 'express';
import { baleWebhookPathToken } from '../../modules/bale/webhook-secret';
import {
  baleWebhookOriginAllowed,
  isAllowedRequestOrigin,
  isBaleWebhookRequest,
  isLoginRequest,
  parseAllowedOrigins,
  shouldSkipOriginGuard,
} from './request-origin';

function req(headers: Record<string, string>, extras?: Partial<Request>): Request {
  return { headers, method: 'POST', url: '/api/v1/orders', ...extras } as Request;
}

describe('request origin', () => {
  it('parses a comma-separated allow list', () => {
    expect(parseAllowedOrigins('https://a.example/ , http://localhost:8080')).toEqual([
      'https://a.example',
      'http://localhost:8080',
    ]);
  });

  it('allows the configured FRONTEND_ORIGIN', () => {
    expect(
      isAllowedRequestOrigin(
        'http://localhost:8080',
        req({ host: '10.0.0.8:8080' }),
        ['http://localhost:8080'],
      ),
    ).toBe(true);
  });

  it('allows same hostname even when ports differ', () => {
    expect(
      isAllowedRequestOrigin(
        'https://khaan.example.com',
        req({ host: 'khaan.example.com:443' }),
        ['http://localhost:8080'],
      ),
    ).toBe(true);
  });

  it('allows Origin that matches X-Forwarded-Host behind TLS', () => {
    expect(
      isAllowedRequestOrigin(
        'https://khaan.example.com',
        req({
          host: 'backend:3000',
          'x-forwarded-host': 'khaan.example.com',
        }),
        ['http://localhost:8080'],
      ),
    ).toBe(true);
  });

  it('skips the origin guard for login even when Host is the container name', () => {
    expect(
      shouldSkipOriginGuard(
        req(
          { host: 'backend:3000', origin: 'https://khaan.example.com' },
          { url: '/api/v1/auth/login' },
        ),
      ),
    ).toBe(true);
  });

  it('does not treat the Bale webhook as a login skip', () => {
    const token = baleWebhookPathToken('webhook-secret-value');
    const webhook = req({}, { url: `/api/v1/bale/webhook/${token}` });
    expect(isLoginRequest(webhook)).toBe(false);
    expect(shouldSkipOriginGuard(webhook)).toBe(false);
    expect(isBaleWebhookRequest(webhook)).toBe(true);
    expect(isBaleWebhookRequest(req({}, { url: '/api/v1/bale/webhook' }))).toBe(false);
    expect(isBaleWebhookRequest(req({}, { url: '/api/v1/bale/webhook/sync' }))).toBe(false);
  });

  it('does not skip origin for other POST endpoints without a browser same-origin signal', () => {
    expect(shouldSkipOriginGuard(req({ host: 'backend:3000' }, { url: '/api/v1/orders' }))).toBe(
      false,
    );
  });

  it('skips the origin guard for same-origin fetch', () => {
    expect(
      shouldSkipOriginGuard(req({ 'sec-fetch-site': 'same-origin' })),
    ).toBe(true);
  });

  it('rejects a foreign Origin for non-login writes', () => {
    expect(
      isAllowedRequestOrigin(
        'https://evil.example',
        req({ host: '10.0.0.8:8080' }),
        ['http://localhost:8080'],
      ),
    ).toBe(false);
    expect(shouldSkipOriginGuard(req({ origin: 'https://evil.example' }))).toBe(
      false,
    );
  });

  it('allows the Bale webhook without Origin and rejects a hostile Origin', () => {
    const token = baleWebhookPathToken('webhook-secret-value');
    const webhook = req(
      { host: 'food.kavosh.site' },
      { url: `/api/v1/bale/webhook/${token}` },
    );
    expect(baleWebhookOriginAllowed(undefined, webhook, ['https://food.kavosh.site'])).toBe(true);
    expect(
      baleWebhookOriginAllowed('https://evil.example', webhook, ['https://food.kavosh.site']),
    ).toBe(false);
    expect(
      baleWebhookOriginAllowed('https://food.kavosh.site', webhook, ['https://food.kavosh.site']),
    ).toBe(true);
  });
});
