import type { Request } from 'express';
import { randomUUID } from 'crypto';

const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_PROPERTY = 'khaanRequestId';
export const BALE_LOGIN_DIAGNOSED_PROPERTY = 'baleLoginDiagnosed';

function headerValue(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? '';
}

export function ensureRequestId(request: Request): string {
  const existing = (request as unknown as Record<string, unknown>)[REQUEST_ID_PROPERTY];
  if (typeof existing === 'string' && existing) {
    return existing;
  }
  const fromHeader = headerValue(request.headers?.[REQUEST_ID_HEADER]);
  const id =
    fromHeader && fromHeader.length <= 128 && /^[\w.:-]+$/.test(fromHeader)
      ? fromHeader
      : randomUUID();
  (request as unknown as Record<string, unknown>)[REQUEST_ID_PROPERTY] = id;
  return id;
}

export function markBaleLoginDiagnosed(request: Request) {
  (request as unknown as Record<string, unknown>)[BALE_LOGIN_DIAGNOSED_PROPERTY] = true;
}

export function wasBaleLoginDiagnosed(request: Request) {
  return (request as unknown as Record<string, unknown>)[BALE_LOGIN_DIAGNOSED_PROPERTY] === true;
}

export function isBaleLoginRequest(request: Request) {
  const method = (request.method ?? 'GET').toUpperCase();
  if (method !== 'POST') {
    return false;
  }
  const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
  return /\/api\/v1\/bale\/auth\/login$/.test(path) || /\/bale\/auth\/login$/.test(path);
}
