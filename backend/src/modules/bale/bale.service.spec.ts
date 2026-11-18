import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { BaleApiError } from './bale-api.errors';
import { BALE_LOGIN_DIAGNOSTIC_EVENT } from './bale-login-diagnostics';
import { computeInitDataHash, verifyBaleInitData } from './init-data';
import { BaleService } from './bale.service';
import { baleWebhookPathToken } from './webhook-secret';

function signedInitData(token: string, fields: Record<string, string>) {
  const pairs = Object.entries(fields).filter(([key]) => key !== 'hash');
  const dataCheckString = pairs
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const hash = computeInitDataHash(token, dataCheckString);
  return new URLSearchParams({ ...fields, hash }).toString();
}

function config(values: Record<string, string | boolean | number>) {
  return {
    get: (key: string) => values[key],
  };
}

function service(overrides?: {
  enabled?: boolean;
  token?: string;
  secret?: string;
  webhookUrl?: string;
  dispatch?: () => Promise<void>;
  login?: () => Promise<{ id: string; username: string; role: string }>;
  api?: Record<string, unknown>;
}) {
  const auth = {
    login: jest.fn(
      overrides?.login ??
        (async () => ({
          id: 'user-1',
          username: 'demo',
          role: 'EMPLOYEE',
          buildingId: null,
          expiresAt: new Date().toISOString(),
        })),
    ),
  };
  const sessions = {
    revokeAllForUser: jest.fn(),
    clearCookie: jest.fn(),
  };
  const links = {
    bind: jest.fn(),
    findUserIdByChat: jest.fn().mockResolvedValue(null),
    findUserIdByBaleUser: jest.fn().mockResolvedValue(null),
  };
  const api = {
    configured: () => true,
    sendMessage: jest.fn().mockResolvedValue({ ok: true }),
    answerCallbackQuery: jest.fn().mockResolvedValue({ ok: true }),
    setWebhook: jest.fn().mockResolvedValue({ ok: true, result: true }),
    getWebhookInfo: jest.fn().mockResolvedValue({ ok: true, result: { url: '' } }),
    ...overrides?.api,
  };
  const instance = new BaleService(
    config({
      BALE_MINI_APP_ENABLED: overrides?.enabled ?? true,
      BALE_BOT_TOKEN: overrides?.token ?? '100:test-token',
      BALE_WEBHOOK_SECRET: overrides?.secret ?? 'webhook-secret-value',
      BALE_INIT_DATA_TTL_SECONDS: 86400,
      BALE_MINI_APP_URL: 'https://food.kavosh.site/mini-app',
      BALE_WEBHOOK_URL:
        overrides?.webhookUrl ?? 'https://food.kavosh.site/api/v1/bale/webhook',
    }) as never,
    auth as never,
    sessions as never,
    links as never,
    api as never,
    { listMine: jest.fn() } as never,
    { getPublished: jest.fn() } as never,
    { user: { findUnique: jest.fn() } } as never,
  );
  if (overrides?.dispatch) {
    (instance as unknown as { dispatch: () => Promise<void> }).dispatch =
      overrides.dispatch;
  }
  return { instance, auth, sessions, links, api };
}

describe('BaleService webhook', () => {
  const secret = 'webhook-secret-value';
  const token = baleWebhookPathToken(secret);

  it('rejects webhook calls when the Mini App is disabled', async () => {
    const { instance } = service({ enabled: false });
    await expect(instance.handleWebhook({ update_id: 1 }, token)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a webhook without a configured secret', async () => {
    const { instance } = service({ secret: '' });
    await expect(instance.handleWebhook({ update_id: 1 }, token)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects a webhook with a missing or wrong secret path', async () => {
    const { instance, api } = service();
    await expect(instance.handleWebhook({ update_id: 1 }, undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      instance.handleWebhook({ update_id: 1 }, 'wrong-secret-value'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('does not accept the raw secret or a body field as the path credential', async () => {
    const { instance, api } = service();
    await expect(
      instance.handleWebhook({ update_id: 1, secret }, secret),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('sends the bot reply for /start when the secret path matches', async () => {
    const { instance, api } = service();
    await expect(
      instance.handleWebhook(
        {
          update_id: 70,
          message: { text: '/start', chat: { id: 99 }, from: { id: 99 } },
        },
        token,
      ),
    ).resolves.toEqual({ ok: true, duplicate: false });
    expect(api.sendMessage).toHaveBeenCalledWith(
      99,
      expect.stringContaining('سامانه خوان'),
      expect.any(Object),
    );
  });

  it('returns ok for a successful update and duplicate for a repeat', async () => {
    const { instance } = service({ dispatch: async () => undefined });
    await expect(
      instance.handleWebhook({ update_id: 44, message: { text: '/start', chat: { id: 1 } } }, token),
    ).resolves.toEqual({ ok: true, duplicate: false });
    await expect(
      instance.handleWebhook({ update_id: 44, message: { text: '/start', chat: { id: 1 } } }, token),
    ).resolves.toEqual({ ok: true, duplicate: true });
  });

  it('fails a broken dispatch so the update can be retried', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new Error('send failed');
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 45, message: { text: '/start', chat: { id: 1 } } }, token),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    const retry = service({ dispatch: async () => undefined });
    retry.instance['processed'] = instance['processed'];
    await expect(
      retry.instance.handleWebhook(
        { update_id: 45, message: { text: '/start', chat: { id: 1 } } },
        token,
      ),
    ).resolves.toEqual({ ok: true, duplicate: false });
  });

  it('does not mark a timeout as processed', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new BaleApiError('Bale sendMessage timed out.', {
          retryable: true,
          kind: 'transient',
        });
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 55, message: { text: '/start', chat: { id: 1 } } }, token),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(instance['processed'].hasSucceeded(55)).toBe(false);
  });

  it('does not mark a network failure as processed', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new BaleApiError('Bale sendMessage network error.', {
          retryable: true,
          kind: 'transient',
        });
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 56, message: { text: '/start', chat: { id: 1 } } }, token),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(instance['processed'].hasSucceeded(56)).toBe(false);
  });

  it('does not mark a retryable Bale API failure as processed', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new BaleApiError('Bale sendMessage failed: Internal Server Error', {
          retryable: true,
          kind: 'transient',
          errorCode: 500,
        });
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 46, message: { text: '/start', chat: { id: 1 } } }, token),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(instance['processed'].hasSucceeded(46)).toBe(false);
  });

  it('does not mark a 429 Too Many Requests failure as processed', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new BaleApiError('Bale sendMessage failed: Too Many Requests', {
          retryable: true,
          kind: 'transient',
          errorCode: 429,
        });
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 49, message: { text: '/start', chat: { id: 1 } } }, token),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(instance['processed'].hasSucceeded(49)).toBe(false);
  });

  it('does not acknowledge a 401 InvalidToken failure', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new BaleApiError('Bale sendMessage failed: Unauthorized', {
          retryable: true,
          kind: 'invalid_token',
          errorCode: 401,
        });
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 48, message: { text: '/start', chat: { id: 1 } } }, token),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(instance['processed'].hasSucceeded(48)).toBe(false);
  });

  it('acknowledges a blocked-user 403 so Bale is not asked to retry forever', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new BaleApiError('Bale sendMessage failed: Forbidden: bot was blocked by the user', {
          retryable: false,
          kind: 'permanent_user',
          errorCode: 403,
        });
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 47, message: { text: '/start', chat: { id: 1 } } }, token),
    ).resolves.toEqual({ ok: true, ignored: true });
    expect(instance['processed'].hasSucceeded(47)).toBe(true);
    await expect(
      instance.handleWebhook({ update_id: 47, message: { text: '/start', chat: { id: 1 } } }, token),
    ).resolves.toEqual({ ok: true, duplicate: true });
  });

  it('does not acknowledge a 403 without blocked-destination evidence', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new BaleApiError('Bale sendMessage failed: Forbidden', {
          retryable: true,
          kind: 'transient',
          errorCode: 403,
        });
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 51, message: { text: '/start', chat: { id: 1 } } }, token),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(instance['processed'].hasSucceeded(51)).toBe(false);
  });

  it('acknowledges a 404 when the chat is gone', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new BaleApiError('Bale sendMessage failed: Not Found: chat not found', {
          retryable: false,
          kind: 'permanent_user',
          errorCode: 404,
        });
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 50, message: { text: '/start', chat: { id: 1 } } }, token),
    ).resolves.toEqual({ ok: true, ignored: true });
    expect(instance['processed'].hasSucceeded(50)).toBe(true);
  });

  it('does not acknowledge a 404 without destination detail', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new BaleApiError('Bale sendMessage failed: Not Found', {
          retryable: true,
          kind: 'transient',
          errorCode: 404,
        });
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 52, message: { text: '/start', chat: { id: 1 } } }, token),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(instance['processed'].hasSucceeded(52)).toBe(false);
  });

  it('acknowledges a 400 for empty message text on that update', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new BaleApiError('Bale sendMessage failed: Bad Request: message text is empty', {
          retryable: false,
          kind: 'permanent_user',
          errorCode: 400,
        });
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 53, message: { text: '/start', chat: { id: 1 } } }, token),
    ).resolves.toEqual({ ok: true, ignored: true });
    expect(instance['processed'].hasSucceeded(53)).toBe(true);
  });

  it('does not acknowledge a 400 caused by an internally malformed request', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new BaleApiError("Bale sendMessage failed: Bad Request: can't parse entities", {
          retryable: true,
          kind: 'transient',
          errorCode: 400,
        });
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 54, message: { text: '/start', chat: { id: 1 } } }, token),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(instance['processed'].hasSucceeded(54)).toBe(false);
  });

  it('registers the webhook during startup without publishing the secret', async () => {
    const delivery = `https://food.kavosh.site/api/v1/bale/webhook/${token}`;
    const setWebhook = jest.fn().mockResolvedValue({ ok: true, result: true });
    const { instance } = service({ api: { setWebhook } });
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    try {
      await instance.onModuleInit();
      expect(setWebhook).toHaveBeenCalledWith(delivery);
      expect(log.mock.calls.flat().join(' ')).not.toContain(token);
      expect(log.mock.calls.flat().join(' ')).not.toContain(secret);
    } finally {
      log.mockRestore();
    }
  });

  it('keeps the process up when startup registration fails', async () => {
    const setWebhook = jest.fn().mockRejectedValue(new Error(`rejected ${token} ${secret}`));
    const { instance } = service({ api: { setWebhook } });
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      await expect(instance.onModuleInit()).resolves.toBeUndefined();
      expect(error.mock.calls.flat().join(' ')).not.toContain(token);
      expect(error.mock.calls.flat().join(' ')).not.toContain(secret);
    } finally {
      error.mockRestore();
    }
  });

  it('does not register a webhook when the Mini App is disabled', async () => {
    const { instance, api } = service({ enabled: false });
    await instance.onModuleInit();
    expect(api.setWebhook).not.toHaveBeenCalled();
  });

  it('registers only the documented webhook url and hides the secret path', async () => {
    const delivery = `https://food.kavosh.site/api/v1/bale/webhook/${token}`;
    const setWebhook = jest.fn().mockResolvedValue({
      ok: true,
      result: true,
      description: `registered ${delivery}`,
    });
    const { instance } = service({ api: { setWebhook } });
    const result = await instance.syncWebhook({ role: 'ADMIN' } as never);
    expect(setWebhook).toHaveBeenCalledTimes(1);
    expect(setWebhook).toHaveBeenCalledWith(delivery);
    const recorded = JSON.stringify(setWebhook.mock.calls);
    expect(recorded).not.toContain('secret_token');
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('does not call setWebhook when the public url is missing', async () => {
    const { instance, api } = service({ webhookUrl: '' });
    await expect(instance.syncWebhook({ role: 'ADMIN' } as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(api.setWebhook).not.toHaveBeenCalled();
  });

  it('redacts the registered url from webhook info', async () => {
    const { instance } = service({
      api: {
        getWebhookInfo: jest.fn().mockResolvedValue({
          ok: true,
          result: { url: `https://food.kavosh.site/api/v1/bale/webhook/${token}?echo=${secret}` },
        }),
      },
    });
    const info = await instance.webhookInfo();
    const encoded = JSON.stringify(info);
    expect(encoded).not.toContain(token);
    expect(encoded).not.toContain(secret);
    expect(encoded).toContain('/api/v1/bale/webhook/[redacted]');
  });
});

function diagnosticEvents(log: jest.SpyInstance) {
  return log.mock.calls
    .map((call) => call[0])
    .filter((value): value is string => typeof value === 'string' && value.includes(BALE_LOGIN_DIAGNOSTIC_EVENT))
    .map((value) => JSON.parse(value) as Record<string, unknown>);
}

describe('BaleService login', () => {
  const token = '100:test-token';
  const user = JSON.stringify({ id: 42, first_name: 'Ali' });
  const now = 1_700_000_000;
  const passwordSentinel = 'login-secret-password-value';
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('rejects login when the bot token is missing', async () => {
    const { instance } = service({ token: '' });
    await expect(
      instance.login(
        { initData: 'x', username: 'demo', password: 'secret' },
        { ip: '127.0.0.1' } as never,
        {} as never,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects login without initData', async () => {
    const { instance, auth } = service();
    const request = { ip: '127.0.0.1', headers: { 'x-request-id': 'corr-empty' } };
    await expect(
      instance.login(
        { initData: '', username: 'demo', password: passwordSentinel },
        request as never,
        {} as never,
      ),
    ).rejects.toMatchObject({
      response: { message: 'initData خالی است.', statusCode: 401 },
    });
    expect(auth.login).not.toHaveBeenCalled();
    expect(diagnosticEvents(logSpy)).toEqual([
      expect.objectContaining({
        requestId: 'corr-empty',
        category: 'init_data_empty',
        status: 401,
        initDataPresent: false,
        initDataLength: 0,
        reachedAuthLogin: false,
        authResult: 'not_reached',
        reason: 'empty',
      }),
    ]);
    expect(JSON.stringify(diagnosticEvents(logSpy))).not.toContain(passwordSentinel);
  });

  it('rejects expired initData', async () => {
    const { instance } = service();
    const initData = signedInitData(token, {
      auth_date: '1000',
      user,
    });
    const request = { ip: '127.0.0.1', headers: { 'x-request-id': 'corr-expired' } };
    await expect(
      instance.login(
        { initData, username: 'demo', password: passwordSentinel },
        request as never,
        {} as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(diagnosticEvents(logSpy)).toEqual([
      expect.objectContaining({
        requestId: 'corr-expired',
        category: 'init_data_expired',
        status: 401,
        reachedAuthLogin: false,
        initDataPresent: true,
        initDataLength: initData.length,
        reason: 'expired',
      }),
    ]);
    expect(JSON.stringify(diagnosticEvents(logSpy))).not.toContain(initData);
  });

  it('rejects tampered initData', async () => {
    const { instance, auth } = service();
    const initData = signedInitData(token, {
      auth_date: String(now),
      user,
    }).replace(/hash=[^&]+/, 'hash=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
    const request = { ip: '127.0.0.1', headers: { 'x-request-id': 'corr-invalid' } };
    await expect(
      instance.login(
        { initData, username: 'demo', password: passwordSentinel },
        request as never,
        {} as never,
      ),
    ).rejects.toMatchObject({
      response: { message: 'امضای دادهٔ بله معتبر نیست.', statusCode: 401 },
    });
    expect(auth.login).not.toHaveBeenCalled();
    expect(diagnosticEvents(logSpy)).toEqual([
      expect.objectContaining({
        requestId: 'corr-invalid',
        category: 'init_data_invalid',
        reason: 'invalid_signature',
        reachedAuthLogin: false,
        authResult: 'not_reached',
      }),
    ]);
    expect(JSON.stringify(diagnosticEvents(logSpy))).not.toContain(initData);
  });

  it('does not keep a session when the Khaan account is inactive', async () => {
    const { instance, links } = service({
      login: async () => {
        throw new ForbiddenException('حساب کاربری غیرفعال است.');
      },
    });
    jest.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const initData = signedInitData(token, {
      auth_date: String(now),
      user,
    });
    const request = { ip: '127.0.0.1', headers: { 'x-request-id': 'corr-inactive' } };
    await expect(
      instance.login(
        { initData, username: 'demo', password: passwordSentinel },
        request as never,
        {} as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(links.bind).not.toHaveBeenCalled();
    expect(diagnosticEvents(logSpy)).toEqual([
      expect.objectContaining({
        requestId: 'corr-inactive',
        category: 'account_inactive',
        status: 403,
        reachedAuthLogin: true,
        authResult: 'account_inactive',
      }),
    ]);
    jest.spyOn(Date, 'now').mockRestore();
  });

  it('logs invalid credentials after initData succeeds', async () => {
    const { instance, auth, links } = service({
      login: async () => {
        throw new UnauthorizedException('نام کاربری یا رمز عبور صحیح نیست.');
      },
    });
    jest.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const initData = signedInitData(token, {
      auth_date: String(now),
      user,
    });
    const request = { ip: '127.0.0.1', headers: { 'x-request-id': 'corr-creds' } };
    await expect(
      instance.login(
        { initData, username: 'demo', password: passwordSentinel },
        request as never,
        {} as never,
      ),
    ).rejects.toMatchObject({
      response: { message: 'نام کاربری یا رمز عبور صحیح نیست.', statusCode: 401 },
    });
    expect(auth.login).toHaveBeenCalled();
    expect(links.bind).not.toHaveBeenCalled();
    expect(diagnosticEvents(logSpy)).toEqual([
      expect.objectContaining({
        requestId: 'corr-creds',
        category: 'credentials_invalid',
        status: 401,
        reachedAuthLogin: true,
        authResult: 'credentials_invalid',
        initDataPresent: true,
      }),
    ]);
    expect(JSON.stringify(diagnosticEvents(logSpy))).not.toContain(passwordSentinel);
    jest.spyOn(Date, 'now').mockRestore();
  });

  it('logs rate limiting after initData succeeds', async () => {
    const { instance } = service({
      login: async () => {
        throw new HttpException('rate', HttpStatus.TOO_MANY_REQUESTS);
      },
    });
    jest.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const initData = signedInitData(token, {
      auth_date: String(now),
      user,
    });
    await expect(
      instance.login(
        { initData, username: 'demo', password: passwordSentinel },
        { ip: '127.0.0.1', headers: { 'x-request-id': 'corr-rate' } } as never,
        {} as never,
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(diagnosticEvents(logSpy)).toEqual([
      expect.objectContaining({
        requestId: 'corr-rate',
        category: 'rate_limited',
        status: 429,
        reachedAuthLogin: true,
        authResult: 'rate_limited',
      }),
    ]);
    jest.spyOn(Date, 'now').mockRestore();
  });

  it('creates a session after valid initData', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const { instance, auth, links } = service();
    const initData = signedInitData(token, {
      auth_date: String(now),
      user,
    });
    expect(verifyBaleInitData(initData, token, now, 60).user.id).toBe(42);
    await instance.login(
      { initData, username: 'demo', password: passwordSentinel },
      { ip: '127.0.0.1', headers: { 'x-request-id': 'corr-ok' } } as never,
      {} as never,
    );
    expect(auth.login).toHaveBeenCalled();
    expect(links.bind).toHaveBeenCalledWith('user-1', 42, '42');
    expect(diagnosticEvents(logSpy)).toEqual([
      expect.objectContaining({
        requestId: 'corr-ok',
        category: 'login_success',
        status: 200,
        reachedAuthLogin: true,
        authResult: 'success',
        initDataPresent: true,
        usernameNormalized: true,
      }),
    ]);
    expect(JSON.stringify(diagnosticEvents(logSpy))).not.toContain(passwordSentinel);
    expect(JSON.stringify(diagnosticEvents(logSpy))).not.toContain(initData);
    jest.spyOn(Date, 'now').mockRestore();
  });
});
