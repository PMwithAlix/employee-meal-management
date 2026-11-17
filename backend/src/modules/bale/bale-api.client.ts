import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import {
  BaleApiError,
  classifyBaleApiFailure,
  redactBaleLogText,
} from './bale-api.errors';
import { redactKnownWebhookSecrets } from './webhook-secret';

type BaleApiResult<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

const BALE_API_TIMEOUT_MS = 10_000;

@Injectable()
export class BaleApiClient {
  private readonly logger = new Logger(BaleApiClient.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  configured() {
    return this.config.get('BALE_BOT_TOKEN', { infer: true }).trim().length > 0;
  }

  async getMe() {
    return this.call('getMe');
  }

  async getWebhookInfo() {
    return this.call('getWebhookInfo');
  }

  async setWebhook(url: string) {
    return this.call('setWebhook', { url });
  }

  async deleteWebhook() {
    return this.call('deleteWebhook');
  }

  private scrub(value: string) {
    const secret = this.config.get('BALE_WEBHOOK_SECRET', { infer: true });
    return redactBaleLogText(redactKnownWebhookSecrets(value, secret));
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    extra: Record<string, unknown> = {},
  ) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      ...extra,
    });
  }

  async answerCallbackQuery(id: string, text?: string) {
    return this.call('answerCallbackQuery', {
      callback_query_id: id,
      text,
    });
  }

  private async call(method: string, body?: Record<string, unknown>) {
    const token = this.config.get('BALE_BOT_TOKEN', { infer: true }).trim();
    if (!token) {
      this.logger.warn(`Bale method ${method} skipped; bot token is empty.`);
      throw new BaleApiError('Bale bot token is not configured.', {
        retryable: true,
      });
    }
    const base = this.config
      .get('BALE_API_BASE_URL', { infer: true })
      .replace(/\/$/, '');
    const url = `${base}${token}/${method}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(BALE_API_TIMEOUT_MS),
      });
      let payload: BaleApiResult<unknown>;
      try {
        payload = (await response.json()) as BaleApiResult<unknown>;
      } catch {
        const classification = classifyBaleApiFailure(
          null,
          response.status,
          '',
          method,
        );
        throw new BaleApiError(`Bale ${method} returned a non-JSON body.`, {
          retryable: classification.retryable,
          kind: classification.kind,
          errorCode: response.status,
        });
      }
      if (!payload.ok) {
        const classification = classifyBaleApiFailure(
          payload.error_code ?? null,
          response.status,
          payload.description ?? '',
          method,
        );
        const description = this.scrub(
          payload.description ?? `HTTP ${response.status}`,
        );
        if (classification.kind === 'invalid_token') {
          this.logger.error(
            `Bale ${method} failed: 401 InvalidToken. Bot authentication is rejected; webhook updates will be retried until BALE_BOT_TOKEN is corrected.`,
          );
        } else {
          this.logger.warn(
            `Bale ${method} failed: ${payload.error_code ?? response.status} ${description}`.trim(),
          );
        }
        throw new BaleApiError(`Bale ${method} failed: ${description}`, {
          retryable: classification.retryable,
          kind: classification.kind,
          errorCode: payload.error_code ?? response.status,
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof BaleApiError) {
        throw error;
      }
      const timedOut =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      this.logger.warn(
        `Bale ${method} ${timedOut ? 'timeout' : 'network error'}: ${
          error instanceof Error ? this.scrub(error.message) : 'unknown'
        }`,
      );
      throw new BaleApiError(
        timedOut ? `Bale ${method} timed out.` : `Bale ${method} network error.`,
        { retryable: true },
      );
    }
  }
}
