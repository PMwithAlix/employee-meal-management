import type { Request } from 'express';

export function parseAllowedOrigins(value: string) {
  return value
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function requestHost(request: Request) {
  const forwarded = request.headers['x-forwarded-host'];
  const raw =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ||
    request.headers.host;
  return raw?.split(',')[0]?.trim() ?? '';
}

export function originHost(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return '';
  }
}

export function isAllowedRequestOrigin(
  origin: string | undefined,
  request: Request,
  allowedOrigins: string[],
) {
  if (!origin) {
    return false;
  }
  const normalized = origin.replace(/\/$/, '');
  if (allowedOrigins.includes(normalized)) {
    return true;
  }
  const host = requestHost(request);
  const fromOrigin = originHost(normalized);
  return Boolean(host && fromOrigin && host === fromOrigin);
}
