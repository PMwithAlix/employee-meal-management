import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { computeInitDataHash, verifyBaleInitData } from './init-data';
import { BaleService } from './bale.service';

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
  dispatch?: () => Promise<void>;
  login?: () => Promise<{ id: string; username: string; role: string }>;
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
  const links = { bind: jest.fn() };
  const instance = new BaleService(
    config({
      BALE_MINI_APP_ENABLED: overrides?.enabled ?? true,
      BALE_BOT_TOKEN: overrides?.token ?? '100:test-token',
      BALE_WEBHOOK_SECRET: overrides?.secret ?? 'webhook-secret-value',
      BALE_INIT_DATA_TTL_SECONDS: 86400,
      BALE_MINI_APP_URL: 'https://food.kavosh.site/mini-app',
      BALE_WEBHOOK_URL: '',
    }) as never,
    auth as never,
    sessions as never,
    links as never,
    { configured: () => true, sendMessage: jest.fn() } as never,
    { listMine: jest.fn() } as never,
    { getPublished: jest.fn() } as never,
    { user: { findUnique: jest.fn() } } as never,
  );
  if (overrides?.dispatch) {
    (instance as unknown as { dispatch: () => Promise<void> }).dispatch =
      overrides.dispatch;
  }
  return { instance, auth, sessions, links };
}

describe('BaleService webhook', () => {
  const headers = {
    'x-telegram-bot-api-secret-token': 'webhook-secret-value',
  };

  it('rejects webhook calls when the Mini App is disabled', async () => {
    const { instance } = service({ enabled: false });
    await expect(instance.handleWebhook({ update_id: 1 }, headers)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a webhook without a configured secret', async () => {
    const { instance } = service({ secret: '' });
    await expect(instance.handleWebhook({ update_id: 1 }, {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects a webhook with a missing or wrong secret header', async () => {
    const { instance } = service();
    await expect(instance.handleWebhook({ update_id: 1 }, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      instance.handleWebhook(
        { update_id: 1 },
        { 'x-telegram-bot-api-secret-token': 'wrong-secret-value' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not treat a query-like secret field as authentication', async () => {
    const { instance } = service();
    await expect(
      instance.handleWebhook({ update_id: 1, secret: 'webhook-secret-value' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns ok for a successful update and duplicate for a repeat', async () => {
    const { instance } = service({ dispatch: async () => undefined });
    await expect(
      instance.handleWebhook({ update_id: 44, message: { text: '/start', chat: { id: 1 } } }, headers),
    ).resolves.toEqual({ ok: true, duplicate: false });
    await expect(
      instance.handleWebhook({ update_id: 44, message: { text: '/start', chat: { id: 1 } } }, headers),
    ).resolves.toEqual({ ok: true, duplicate: true });
  });

  it('fails a broken dispatch so the update can be retried', async () => {
    const { instance } = service({
      dispatch: async () => {
        throw new Error('send failed');
      },
    });
    await expect(
      instance.handleWebhook({ update_id: 45, message: { text: '/start', chat: { id: 1 } } }, headers),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    const retry = service({ dispatch: async () => undefined });
    retry.instance['processed'] = instance['processed'];
    await expect(
      retry.instance.handleWebhook(
        { update_id: 45, message: { text: '/start', chat: { id: 1 } } },
        headers,
      ),
    ).resolves.toEqual({ ok: true, duplicate: false });
  });
});

describe('BaleService login', () => {
  const token = '100:test-token';
  const user = JSON.stringify({ id: 42, first_name: 'Ali' });
  const now = 1_700_000_000;

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
    await expect(
      instance.login(
        { initData: '', username: 'demo', password: 'secret' },
        { ip: '127.0.0.1' } as never,
        {} as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('rejects expired initData', async () => {
    const { instance } = service();
    const initData = signedInitData(token, {
      auth_date: '1000',
      user,
    });
    await expect(
      instance.login(
        { initData, username: 'demo', password: 'secret' },
        { ip: '127.0.0.1' } as never,
        {} as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tampered initData', async () => {
    const { instance, auth } = service();
    const initData = signedInitData(token, {
      auth_date: String(now),
      user,
    }).replace(/hash=[^&]+/, 'hash=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
    await expect(
      instance.login(
        { initData, username: 'demo', password: 'secret' },
        { ip: '127.0.0.1' } as never,
        {} as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.login).not.toHaveBeenCalled();
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
    await expect(
      instance.login(
        { initData, username: 'demo', password: 'secret' },
        { ip: '127.0.0.1' } as never,
        {} as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(links.bind).not.toHaveBeenCalled();
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
      { initData, username: 'demo', password: 'secret' },
      { ip: '127.0.0.1' } as never,
      {} as never,
    );
    expect(auth.login).toHaveBeenCalled();
    expect(links.bind).toHaveBeenCalledWith('user-1', 42, '42');
    jest.spyOn(Date, 'now').mockRestore();
  });
});
