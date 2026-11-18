import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { InitDataError } from './init-data';
import {
  BALE_LOGIN_DIAGNOSTIC_EVENT,
  BALE_LOGIN_ENDPOINT,
  assertSafeDiagnosticEvent,
  categoryFromInitDataCode,
  classifyAuthError,
  classifyBindError,
  classifyInitDataError,
  classifyUnhandledBaleLoginError,
  emitBaleLoginDiagnostic,
  initDataPresence,
} from './bale-login-diagnostics';

function parseDiagnosticLogs(log: jest.SpyInstance) {
  return log.mock.calls
    .map((call) => call[0])
    .filter((value): value is string => typeof value === 'string' && value.includes(BALE_LOGIN_DIAGNOSTIC_EVENT))
    .map((value) => JSON.parse(value) as Record<string, unknown>);
}

describe('bale login diagnostics classification', () => {
  it('maps empty initData to init_data_empty', () => {
    expect(categoryFromInitDataCode('empty')).toBe('init_data_empty');
    expect(classifyInitDataError(new InitDataError('initData خالی است.', 'empty'))).toEqual({
      category: 'init_data_empty',
      reason: 'empty',
    });
    expect(initDataPresence('')).toEqual({ initDataPresent: false, initDataLength: 0 });
    expect(initDataPresence('   ')).toEqual({ initDataPresent: false, initDataLength: 3 });
  });

  it('maps signature and user validation failures to init_data_invalid', () => {
    expect(classifyInitDataError(new InitDataError('امضای دادهٔ بله معتبر نیست.', 'invalid_signature'))).toEqual({
      category: 'init_data_invalid',
      reason: 'invalid_signature',
    });
    expect(classifyInitDataError(new InitDataError('امضای initData موجود نیست.', 'missing_hash')).reason).toBe(
      'missing_hash',
    );
    expect(classifyInitDataError(new InitDataError('دادهٔ کاربر بله نامعتبر است.', 'invalid_user_json')).category).toBe(
      'init_data_invalid',
    );
  });

  it('maps expired initData to init_data_expired', () => {
    expect(classifyInitDataError(new InitDataError('منقضی', 'expired'))).toEqual({
      category: 'init_data_expired',
      reason: 'expired',
    });
  });

  it('maps AuthService exception types without using HTTP status alone', () => {
    expect(classifyAuthError(new UnauthorizedException('نام کاربری یا رمز عبور صحیح نیست.'))).toEqual({
      category: 'credentials_invalid',
      status: 401,
      authResult: 'credentials_invalid',
    });
    expect(classifyAuthError(new ForbiddenException('حساب کاربری شما غیرفعال است.'))).toEqual({
      category: 'account_inactive',
      status: 403,
      authResult: 'account_inactive',
    });
    expect(
      classifyAuthError(new HttpException('rate', HttpStatus.TOO_MANY_REQUESTS)),
    ).toEqual({
      category: 'rate_limited',
      status: 429,
      authResult: 'rate_limited',
    });
  });

  it('keeps bind conflicts distinct from credential failures', () => {
    expect(classifyBindError(new ConflictException('taken'))).toEqual({
      category: 'bind_conflict',
      status: 409,
      reason: 'bind_conflict',
    });
  });

  it('classifies validation failures that never reach the service', () => {
    expect(classifyUnhandledBaleLoginError(new HttpException(['initData must be a string'], 400))).toMatchObject({
      category: 'request_invalid',
      status: 400,
      reason: 'validation',
      authResult: 'not_reached',
    });
  });
});

describe('bale login diagnostic emission', () => {
  it('includes a correlation id and never writes secrets', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const request = {
      headers: { 'x-request-id': 'corr-bale-login-1' },
    } as never;
    const password = 'SUPER-SECRET-PASSWORD';
    const initData = 'user={"id":1}&hash=raw-init-data-secret';
    emitBaleLoginDiagnostic(new Logger('test'), request, {
      status: 401,
      category: 'init_data_empty',
      initDataPresent: false,
      initDataLength: initData.length,
      reachedAuthLogin: false,
      authResult: 'not_reached',
      usernameNormalized: true,
      reason: 'empty',
    });
    const events = parseDiagnosticLogs(log);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: BALE_LOGIN_DIAGNOSTIC_EVENT,
      requestId: 'corr-bale-login-1',
      endpoint: BALE_LOGIN_ENDPOINT,
      status: 401,
      category: 'init_data_empty',
      initDataPresent: false,
      initDataLength: initData.length,
      reachedAuthLogin: false,
      authResult: 'not_reached',
      usernameNormalized: true,
      reason: 'empty',
    });
    expect(typeof events[0].timestamp).toBe('string');
    const serialized = JSON.stringify(events[0]);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(initData);
    expect(serialized).not.toContain('raw-init-data-secret');
    expect(serialized).not.toMatch(/password|passwordHash|cookie|authorization|initData":/i);
    expect(() => assertSafeDiagnosticEvent(events[0] as never)).not.toThrow();
    log.mockRestore();
  });

  it('logs request_invalid from the exception filter once without dumping the body', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const password = 'filter-secret-password';
    const initData = 'hash=filter-init-secret';
    const request = {
      method: 'POST',
      url: '/api/v1/bale/auth/login',
      originalUrl: '/api/v1/bale/auth/login',
      headers: { 'x-request-id': 'corr-filter-1' },
      body: { initData, username: 'danny', password },
    };
    new HttpExceptionFilter().catch(
      new HttpException({ message: ['username must be a string'] }, 400),
      {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
          getRequest: () => request,
        }),
      } as never,
    );
    const events = parseDiagnosticLogs(log);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      requestId: 'corr-filter-1',
      category: 'request_invalid',
      status: 400,
      reachedAuthLogin: false,
      initDataPresent: true,
      initDataLength: initData.length,
    });
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(initData);
    expect(json.mock.calls[0][0]).toMatchObject({
      statusCode: 400,
      message: ['username must be a string'],
    });
    log.mockRestore();
  });

  it('does not emit a second diagnostic when the service already logged the request', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const request = {
      method: 'POST',
      url: '/api/v1/bale/auth/login',
      originalUrl: '/api/v1/bale/auth/login',
      headers: { 'x-request-id': 'corr-once' },
      body: { initData: '', username: 'demo', password: 'secret' },
    };
    emitBaleLoginDiagnostic(new Logger('test'), request as never, {
      status: 401,
      category: 'init_data_empty',
      initDataPresent: false,
      initDataLength: 0,
      reachedAuthLogin: false,
      authResult: 'not_reached',
      usernameNormalized: true,
      reason: 'empty',
    });
    new HttpExceptionFilter().catch(
      new UnauthorizedException('initData خالی است.'),
      {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
          getRequest: () => request,
        }),
      } as never,
    );
    expect(parseDiagnosticLogs(log)).toHaveLength(1);
    log.mockRestore();
  });
});
