import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';

type BaleApiResult<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

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

  async setWebhook(url: string, secretToken: string) {
    return this.call('setWebhook', {
      url,
      secret_token: secretToken || undefined,
    });
  }

  async deleteWebhook() {
    return this.call('deleteWebhook');
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
      this.logger.warn(`Bale method ${method} skipped; BALE_BOT_TOKEN is empty.`);
      return { ok: false, description: 'bot token missing' } satisfies BaleApiResult<unknown>;
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
      });
      const payload = (await response.json()) as BaleApiResult<unknown>;
      if (!payload.ok) {
        this.logger.warn(
          `Bale ${method} failed: ${payload.error_code ?? response.status} ${payload.description ?? ''}`.trim(),
        );
      }
      return payload;
    } catch (error) {
      this.logger.warn(
        `Bale ${method} network error: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return { ok: false, description: 'network error' } satisfies BaleApiResult<unknown>;
    }
  }
}
