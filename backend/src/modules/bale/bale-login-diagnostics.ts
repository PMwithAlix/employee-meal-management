import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ensureRequestId,
  markBaleLoginDiagnosed,
} from '../../common/http/request-id';
import { normalizeUsername } from '../auth/security/username';
import { InitDataError, type InitDataFailureCode } from './init-data';

export const BALE_LOGIN_ENDPOINT = 'POST /api/v1/bale/auth/login';
export const BALE_LOGIN_DIAGNOSTIC_EVENT = 'bale.auth.login';

export type BaleLoginDiagnosticCategory =
  | 'init_data_empty'
  | 'init_data_invalid'
  | 'init_data_expired'
  | 'credentials_invalid'
  | 'account_inactive'
  | 'rate_limited'
  | 'login_success'
  | 'mini_app_disabled'
  | 'bot_unconfigured'
  | 'bind_conflict'
  | 'request_invalid'
  | 'login_error';

export type BaleLoginAuthResult =
  | 'not_reached'
  | 'success'
  | 'credentials_invalid'
  | 'account_inactive'
  | 'rate_limited'
  | 'error';

export type BaleLoginDiagnosticEvent = {
  event: typeof BALE_LOGIN_DIAGNOSTIC_EVENT;
  timestamp: string;
  requestId: string;
  endpoint: typeof BALE_LOGIN_ENDPOINT;
  status: number;
  category: BaleLoginDiagnosticCategory;
  initDataPresent: boolean;
  initDataLength: number;
  reachedAuthLogin: boolean;
  authResult: BaleLoginAuthResult;
  usernameNormalized: boolean;
  reason?: InitDataFailureCode | 'validation' | 'bind_conflict' | 'bind_error';
};

const SENSITIVE_EVENT_KEYS = new Set([
  'password',
  'passwordHash',
  'initData',
  'token',
  'cookie',
  'authorization',
  'username',
  'body',
]);

export function initDataPresence(initData: unknown) {
  const value = typeof initData === 'string' ? initData : '';
  return {
    initDataPresent: value.trim().length > 0,
    initDataLength: value.length,
  };
}

export function categoryFromInitDataCode(
  code: InitDataFailureCode,
): BaleLoginDiagnosticCategory {
  if (code === 'empty') {
    return 'init_data_empty';
  }
  if (code === 'expired') {
    return 'init_data_expired';
  }
  if (code === 'missing_bot_token') {
    return 'bot_unconfigured';
  }
  return 'init_data_invalid';
}

export function classifyInitDataError(error: unknown): {
  category: BaleLoginDiagnosticCategory;
  reason?: InitDataFailureCode;
} {
  if (error instanceof InitDataError) {
    return {
      category: categoryFromInitDataCode(error.code),
      reason: error.code,
    };
  }
  return { category: 'init_data_invalid' };
}

export function classifyAuthError(error: unknown): {
  category: BaleLoginDiagnosticCategory;
  status: number;
  authResult: BaleLoginAuthResult;
} {
  if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
    return {
      category: 'rate_limited',
      status: HttpStatus.TOO_MANY_REQUESTS,
      authResult: 'rate_limited',
    };
  }
  if (error instanceof ForbiddenException) {
    return {
      category: 'account_inactive',
      status: HttpStatus.FORBIDDEN,
      authResult: 'account_inactive',
    };
  }
  if (error instanceof UnauthorizedException) {
    return {
      category: 'credentials_invalid',
      status: HttpStatus.UNAUTHORIZED,
      authResult: 'credentials_invalid',
    };
  }
  const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
  return { category: 'login_error', status, authResult: 'error' };
}

export function classifyBindError(error: unknown): {
  category: BaleLoginDiagnosticCategory;
  status: number;
  reason: 'bind_conflict' | 'bind_error';
} {
  if (error instanceof ConflictException) {
    return {
      category: 'bind_conflict',
      status: HttpStatus.CONFLICT,
      reason: 'bind_conflict',
    };
  }
  const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
  return { category: 'login_error', status, reason: 'bind_error' };
}

export function classifyUnhandledBaleLoginError(error: unknown): {
  category: BaleLoginDiagnosticCategory;
  status: number;
  authResult: BaleLoginAuthResult;
  reason?: 'validation';
} {
  if (error instanceof NotFoundException) {
    return {
      category: 'mini_app_disabled',
      status: HttpStatus.NOT_FOUND,
      authResult: 'not_reached',
    };
  }
  if (error instanceof ServiceUnavailableException) {
    return {
      category: 'bot_unconfigured',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      authResult: 'not_reached',
    };
  }
  if (error instanceof HttpException && error.getStatus() === HttpStatus.BAD_REQUEST) {
    return {
      category: 'request_invalid',
      status: HttpStatus.BAD_REQUEST,
      authResult: 'not_reached',
      reason: 'validation',
    };
  }
  return classifyAuthError(error);
}

export function assertSafeDiagnosticEvent(event: BaleLoginDiagnosticEvent) {
  for (const key of Object.keys(event)) {
    if (SENSITIVE_EVENT_KEYS.has(key)) {
      throw new Error(`diagnostic event must not include ${key}`);
    }
  }
}

export function emitBaleLoginDiagnostic(
  logger: Logger,
  request: Request,
  event: Omit<BaleLoginDiagnosticEvent, 'event' | 'timestamp' | 'requestId' | 'endpoint'>,
) {
  const payload: BaleLoginDiagnosticEvent = {
    event: BALE_LOGIN_DIAGNOSTIC_EVENT,
    timestamp: new Date().toISOString(),
    requestId: ensureRequestId(request),
    endpoint: BALE_LOGIN_ENDPOINT,
    ...event,
  };
  assertSafeDiagnosticEvent(payload);
  logger.log(JSON.stringify(payload));
  markBaleLoginDiagnosed(request);
}

export function diagnosticUsernameNormalized(username: unknown) {
  return typeof username === 'string' && normalizeUsername(username).length > 0;
}
