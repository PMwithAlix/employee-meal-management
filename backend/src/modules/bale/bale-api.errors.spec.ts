import {
  classifyBaleApiFailure,
  redactBaleLogText,
} from './bale-api.errors';

describe('classifyBaleApiFailure', () => {
  it('treats 401 InvalidToken as a retryable configuration failure', () => {
    expect(
      classifyBaleApiFailure(401, 401, 'Unauthorized', 'sendMessage'),
    ).toEqual({ retryable: true, kind: 'invalid_token' });
  });

  it('acknowledges 403 only when the destination blocked or kicked the bot', () => {
    expect(
      classifyBaleApiFailure(
        403,
        403,
        'Forbidden: bot was blocked by the user',
        'sendMessage',
      ),
    ).toEqual({ retryable: false, kind: 'permanent_user' });
  });

  it('retries a 403 without evidence that the destination is blocked', () => {
    expect(
      classifyBaleApiFailure(403, 403, 'Forbidden', 'sendMessage'),
    ).toEqual({ retryable: true, kind: 'transient' });
  });

  it('acknowledges 404 only when the chat or user is missing', () => {
    expect(
      classifyBaleApiFailure(404, 404, 'Not Found: chat not found', 'sendMessage'),
    ).toEqual({ retryable: false, kind: 'permanent_user' });
  });

  it('retries a 404 with no destination detail', () => {
    expect(classifyBaleApiFailure(404, 404, 'Not Found', 'sendMessage')).toEqual(
      { retryable: true, kind: 'transient' },
    );
  });

  it('acknowledges 400 only for invalid input on that update', () => {
    expect(
      classifyBaleApiFailure(
        400,
        400,
        'Bad Request: message text is empty',
        'sendMessage',
      ),
    ).toEqual({ retryable: false, kind: 'permanent_user' });
  });

  it('retries a 400 that looks like an internal request construction error', () => {
    expect(
      classifyBaleApiFailure(400, 400, 'Bad Request: can\'t parse entities', 'sendMessage'),
    ).toEqual({ retryable: true, kind: 'transient' });
  });

  it('retries 429 Too Many Requests and 5xx', () => {
    expect(classifyBaleApiFailure(429, 429, 'Too Many Requests', 'sendMessage')).toEqual({
      retryable: true,
      kind: 'transient',
    });
    expect(
      classifyBaleApiFailure(500, 500, 'Internal Server Error', 'sendMessage'),
    ).toEqual({ retryable: true, kind: 'transient' });
  });

  it('does not treat a 403 on setWebhook as a per-user dead letter', () => {
    expect(
      classifyBaleApiFailure(
        403,
        403,
        'Forbidden: bot was blocked by the user',
        'setWebhook',
      ),
    ).toEqual({ retryable: true, kind: 'transient' });
  });

  it('does not leave a bot token in log text', () => {
    expect(
      redactBaleLogText('failed https://tapi.bale.ai/bot100:test-token-value/sendMessage'),
    ).not.toMatch(/test-token-value/);
  });
});
