import type { Request } from 'express';
import {
  isAllowedRequestOrigin,
  parseAllowedOrigins,
} from './request-origin';

function req(headers: Record<string, string>): Request {
  return { headers } as Request;
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

  it('allows same-host Origin when the public URL is not localhost', () => {
    expect(
      isAllowedRequestOrigin(
        'http://10.0.0.8:8080',
        req({ host: '10.0.0.8:8080' }),
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

  it('rejects a foreign Origin', () => {
    expect(
      isAllowedRequestOrigin(
        'https://evil.example',
        req({ host: '10.0.0.8:8080' }),
        ['http://localhost:8080'],
      ),
    ).toBe(false);
  });
});
