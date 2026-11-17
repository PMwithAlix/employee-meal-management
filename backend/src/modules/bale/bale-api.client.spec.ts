import { Logger } from '@nestjs/common';
import { BaleApiClient } from './bale-api.client';
import { BaleApiError } from './bale-api.errors';
import { baleWebhookPathToken } from './webhook-secret';

function client(secret = '') {
  return new BaleApiClient({
    get: (key: string) => {
      if (key === 'BALE_BOT_TOKEN') return '100:test-token';
      if (key === 'BALE_API_BASE_URL') return 'https://tapi.bale.ai/bot';
      if (key === 'BALE_WEBHOOK_SECRET') return secret;
      return '';
    },
  } as never);
}

describe('BaleApiClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('registers a webhook with only the documented url parameter', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, result: true }),
    });
    global.fetch = fetchMock as never;
    const url = 'https://food.kavosh.site/api/v1/bale/webhook/path-token';
    await expect(client().setWebhook(url)).resolves.toEqual({ ok: true, result: true });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as Record<string, unknown>;
    expect(body).toEqual({ url });
    expect(body).not.toHaveProperty('secret_token');
  });

  it('does not keep the webhook secret in a setWebhook error', async () => {
    const secret = 'webhook-secret-value';
    const token = baleWebhookPathToken(secret);
    const url = `https://food.kavosh.site/api/v1/bale/webhook/${token}`;
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      json: async () => ({
        ok: false,
        error_code: 400,
        description: `bad url ${url} secret ${secret}`,
      }),
    }) as never;
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = await client(secret)
      .setWebhook(url)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BaleApiError);
    expect(String((error as BaleApiError).message)).not.toContain(token);
    expect(String((error as BaleApiError).message)).not.toContain(secret);
    expect(warn.mock.calls.flat().join(' ')).not.toContain(token);
    expect(warn.mock.calls.flat().join(' ')).not.toContain(secret);
    warn.mockRestore();
  });

  it('returns the payload when Bale reports ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 9 } }),
    }) as never;
    await expect(client().sendMessage(1, 'hello')).resolves.toEqual({
      ok: true,
      result: { message_id: 9 },
    });
  });

  it('throws a non-retryable error when the user blocked the bot (403)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 403,
      json: async () => ({
        ok: false,
        error_code: 403,
        description: 'Forbidden: bot was blocked by the user',
      }),
    }) as never;
    await expect(client().sendMessage(1, 'hello')).rejects.toMatchObject({
      name: 'BaleApiError',
      retryable: false,
      kind: 'permanent_user',
      errorCode: 403,
    });
  });

  it('throws a retryable error for a 403 without a blocked-destination description', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 403,
      json: async () => ({
        ok: false,
        error_code: 403,
        description: 'Forbidden',
      }),
    }) as never;
    await expect(client().sendMessage(1, 'hello')).rejects.toMatchObject({
      retryable: true,
      kind: 'transient',
      errorCode: 403,
    });
  });

  it('throws a non-retryable error when the chat is gone (404)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 404,
      json: async () => ({
        ok: false,
        error_code: 404,
        description: 'Not Found: chat not found',
      }),
    }) as never;
    await expect(client().sendMessage(1, 'hello')).rejects.toMatchObject({
      retryable: false,
      kind: 'permanent_user',
      errorCode: 404,
    });
  });

  it('throws a retryable error for a 404 without destination detail', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 404,
      json: async () => ({
        ok: false,
        error_code: 404,
        description: 'Not Found',
      }),
    }) as never;
    await expect(client().sendMessage(1, 'hello')).rejects.toMatchObject({
      retryable: true,
      kind: 'transient',
      errorCode: 404,
    });
  });

  it('throws a non-retryable error for empty message text (400)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      json: async () => ({
        ok: false,
        error_code: 400,
        description: 'Bad Request: message text is empty',
      }),
    }) as never;
    await expect(client().sendMessage(1, '')).rejects.toMatchObject({
      retryable: false,
      kind: 'permanent_user',
      errorCode: 400,
    });
  });

  it('throws a retryable error for an internally malformed 400', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      json: async () => ({
        ok: false,
        error_code: 400,
        description: "Bad Request: can't parse entities",
      }),
    }) as never;
    await expect(client().sendMessage(1, 'hello')).rejects.toMatchObject({
      retryable: true,
      kind: 'transient',
      errorCode: 400,
    });
  });

  it('throws a retryable InvalidToken error on 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      json: async () => ({
        ok: false,
        error_code: 401,
        description: 'Unauthorized',
      }),
    }) as never;
    const error = await client()
      .sendMessage(1, 'hello')
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BaleApiError);
    expect(error).toMatchObject({
      retryable: true,
      kind: 'invalid_token',
      errorCode: 401,
    });
    expect(String((error as BaleApiError).message)).not.toMatch(/100:test-token/);
  });

  it('throws a retryable error on Bale 429', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 429,
      json: async () => ({
        ok: false,
        error_code: 429,
        description: 'Too Many Requests',
      }),
    }) as never;
    const error = await client()
      .sendMessage(1, 'hello')
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BaleApiError);
    expect((error as BaleApiError).retryable).toBe(true);
    expect((error as BaleApiError).kind).toBe('transient');
  });

  it('throws a retryable error on Bale 500', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 500,
      json: async () => ({
        ok: false,
        error_code: 500,
        description: 'Internal Server Error',
      }),
    }) as never;
    const error = await client()
      .sendMessage(1, 'hello')
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BaleApiError);
    expect((error as BaleApiError).retryable).toBe(true);
  });

  it('throws a retryable error on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed')) as never;
    const error = await client()
      .sendMessage(1, 'hello')
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BaleApiError);
    expect((error as BaleApiError).retryable).toBe(true);
  });

  it('throws a retryable error on timeout', async () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'TimeoutError';
    global.fetch = jest.fn().mockRejectedValue(abort) as never;
    const error = await client()
      .sendMessage(1, 'hello')
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BaleApiError);
    expect((error as BaleApiError).retryable).toBe(true);
  });
});
