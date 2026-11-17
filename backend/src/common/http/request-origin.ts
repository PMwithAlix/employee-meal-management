import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function parseAllowedOrigins(value: string) {
  return value
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function headerValue(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(',')[0]?.trim() ?? '';
}

export function canonicalHost(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  try {
    const url = trimmed.includes('://')
      ? new URL(trimmed)
      : new URL(`http://${trimmed}`);
    return url.hostname;
  } catch {
    return trimmed.replace(/^\[/, '').replace(/\]:\d+$/, '').replace(/:\d+$/, '');
  }
}

export function requestHost(request: Request) {
  const forwarded = headerValue(request.headers['x-forwarded-host']);
  const raw = forwarded || headerValue(request.headers.host);
  return canonicalHost(raw);
}

export function originHost(origin: string) {
  return canonicalHost(origin);
}

export function requestPath(request: Request) {
  return request.originalUrl ?? request.url ?? '';
}

export function isBrowserSameOrigin(request: Request) {
  const site = headerValue(request.headers['sec-fetch-site']).toLowerCase();
  return site === 'same-origin' || site === 'same-site';
}

export function isLoginRequest(request: Request) {
  const path = requestPath(request).split('?')[0];
  return (
    /\/api\/v1\/auth\/login$/.test(path) ||
    /\/api\/v1\/bale\/auth\/login$/.test(path)
  );
}

export function isBaleWebhookRequest(request: Request) {
  const method = (request.method ?? 'GET').toUpperCase();
  if (method !== 'POST') {
    return false;
  }
  const path = requestPath(request).split('?')[0];
  return /\/api\/v1\/bale\/webhook$/.test(path);
}

export function baleWebhookOriginAllowed(
  origin: string | undefined,
  request: Request,
  allowedOrigins: string[],
) {
  if (!origin) {
    return true;
  }
  return isAllowedRequestOrigin(origin, request, allowedOrigins);
}

export function shouldSkipOriginGuard(request: Request) {
  const method = (request.method ?? 'GET').toUpperCase();
  if (SAFE_METHODS.has(method) || requestPath(request).includes('/health')) {
    return true;
  }
  if (isLoginRequest(request)) {
    return true;
  }
  return isBrowserSameOrigin(request);
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
