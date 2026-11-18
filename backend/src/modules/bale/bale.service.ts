import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { gregorianToJalali } from '../../common/calendar/jalali';
import type { AuthUser } from '../../common/types/auth-user';
import { EnvironmentVariables } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { MenusService } from '../menus/menus.service';
import { OrdersService } from '../orders/employee/orders.service';
import { BaleApiClient } from './bale-api.client';
import {
  isInvalidBaleTokenFailure,
  isPermanentBaleFailure,
  redactBaleLogText,
} from './bale-api.errors';
import { BaleLinkStore } from './bale.links';
import { botHelpText, roleKeyboard, SUPPORT_CONTACT } from './bot-menu';
import { BaleLoginDto } from './dto/bale-login.dto';
import { InitDataError, verifyBaleInitData } from './init-data';
import { ProcessedUpdates } from './processed-updates';
import {
  baleWebhookDeliveryUrl,
  redactKnownWebhookSecrets,
  redactKnownWebhookSecretsDeep,
  webhookPathTokenMatches,
} from './webhook-secret';

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

@Injectable()
export class BaleService implements OnModuleInit {
  private readonly logger = new Logger(BaleService.name);
  private readonly processed = new ProcessedUpdates();

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly links: BaleLinkStore,
    private readonly api: BaleApiClient,
    private readonly orders: OrdersService,
    private readonly menus: MenusService,
    private readonly prisma: PrismaService,
  ) {}

  enabled() {
    return this.config.get('BALE_MINI_APP_ENABLED', { infer: true });
  }

  miniAppUrl() {
    return this.config.get('BALE_MINI_APP_URL', { infer: true });
  }

  requireEnabled() {
    if (!this.enabled()) {
      throw new NotFoundException();
    }
  }

  status() {
    return {
      enabled: this.enabled(),
      botConfigured: this.api.configured(),
      miniAppUrl: this.miniAppUrl(),
      webhookConfigured:
        this.config.get('BALE_WEBHOOK_URL', { infer: true }).trim().length > 0,
    };
  }

  async login(dto: BaleLoginDto, request: Request, response: Response) {
    this.requireEnabled();
    const token = this.config.get('BALE_BOT_TOKEN', { infer: true }).trim();
    if (!token) {
      throw new ServiceUnavailableException(
        'ورود بله پیکربندی نشده است.',
      );
    }

    let baleUserId: number;
    try {
      const verified = verifyBaleInitData(
        dto.initData,
        token,
        Math.floor(Date.now() / 1000),
        this.config.get('BALE_INIT_DATA_TTL_SECONDS', { infer: true }),
      );
      baleUserId = verified.user.id;
    } catch (error) {
      const message =
        error instanceof InitDataError
          ? error.message
          : 'اعتبارسنجی بله انجام نشد.';
      throw new UnauthorizedException(message);
    }

    const clientKey = `${request.ip ?? 'unknown'}:bale:${dto.username}`;
    const session = await this.auth.login(
      { username: dto.username, password: dto.password },
      clientKey,
      response,
    );

    try {
      await this.links.bind(session.id, baleUserId, String(baleUserId));
    } catch (error) {
      await this.sessions.revokeAllForUser(session.id);
      this.sessions.clearCookie(response);
      throw error;
    }

    return {
      ...session,
      baleLinked: true,
    };
  }

  assertWebhookSecret(token: string | undefined) {
    const expected = this.config.get('BALE_WEBHOOK_SECRET', { infer: true }).trim();
    if (!expected) {
      throw new ServiceUnavailableException();
    }
    if (!webhookPathTokenMatches(token, expected)) {
      throw new UnauthorizedException();
    }
  }

  async handleWebhook(body: unknown, token: string | undefined) {
    this.requireEnabled();
    this.assertWebhookSecret(token);
    const update = asRecord(body);
    if (!update) {
      return { ok: true, ignored: true };
    }
    const updateId = typeof update.update_id === 'number' ? update.update_id : null;
    if (updateId === null) {
      return { ok: true, ignored: true };
    }
    try {
      const result = await this.processed.run(updateId, () =>
        this.dispatch(update),
      );
      return { ok: true, duplicate: result === 'duplicate' };
    } catch (error) {
      const secret = this.config.get('BALE_WEBHOOK_SECRET', { infer: true }).trim();
      const detail = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(
        `Bale update ${updateId} failed: ${redactKnownWebhookSecrets(
          redactBaleLogText(detail),
          secret,
        )}`,
      );
      if (isPermanentBaleFailure(error)) {
        this.processed.acknowledge(updateId);
        return { ok: true, ignored: true };
      }
      if (isInvalidBaleTokenFailure(error)) {
        this.logger.error(
          `Bale update ${updateId} failed because the bot token was rejected (401). The update was not acknowledged.`,
        );
      }
      throw new InternalServerErrorException();
    }
  }

  async onModuleInit() {
    if (!this.enabled()) {
      return;
    }
    try {
      await this.registerWebhook();
      this.logger.log('Bale webhook registered.');
    } catch (error) {
      const secret = this.config.get('BALE_WEBHOOK_SECRET', { infer: true }).trim();
      const detail = error instanceof Error ? error.message : 'unknown';
      this.logger.error(
        `Bale webhook registration failed: ${redactKnownWebhookSecrets(
          redactBaleLogText(detail),
          secret,
        )}`,
      );
    }
  }

  async syncWebhook(actor: AuthUser) {
    this.requireEnabled();
    if (actor.role !== Role.ADMIN) {
      throw new UnauthorizedException();
    }
    return this.registerWebhook();
  }

  private async registerWebhook() {
    const configured = this.config.get('BALE_WEBHOOK_URL', { infer: true }).trim();
    const secret = this.config.get('BALE_WEBHOOK_SECRET', { infer: true }).trim();
    if (!configured) {
      throw new NotFoundException('BALE_WEBHOOK_URL تنظیم نشده است.');
    }
    if (!secret) {
      throw new ServiceUnavailableException();
    }
    const url = baleWebhookDeliveryUrl(configured, secret);
    if (!url) {
      throw new NotFoundException('BALE_WEBHOOK_URL تنظیم نشده است.');
    }
    const result = await this.api.setWebhook(url);
    return redactKnownWebhookSecretsDeep(result, secret);
  }

  async webhookInfo() {
    this.requireEnabled();
    const secret = this.config.get('BALE_WEBHOOK_SECRET', { infer: true }).trim();
    const info = await this.api.getWebhookInfo();
    return redactKnownWebhookSecretsDeep(info, secret);
  }

  private async dispatch(update: Record<string, unknown>) {
    const message = asRecord(update.message);
    const callback = asRecord(update.callback_query);
    if (callback) {
      const id = typeof callback.id === 'string' ? callback.id : '';
      if (id) await this.api.answerCallbackQuery(id);
      const fromMessage = asRecord(callback.message);
      await this.replyToMessage(fromMessage, asRecord(callback.from), '');
      return;
    }
    if (!message) return;
    const text = typeof message.text === 'string' ? message.text.trim() : '';
    const from = asRecord(message.from);
    await this.replyToMessage(message, from, text);
  }

  private async replyToMessage(
    message: Record<string, unknown> | null,
    from: Record<string, unknown> | null,
    text: string,
  ) {
    const chat = asRecord(message?.chat) ?? asRecord(from);
    const chatId = typeof chat?.id === 'number' ? chat.id : null;
    if (chatId === null) return;

    const linked = await this.loadLinkedUser(String(chatId), from);
    const command = this.normalizeCommand(text);

    if (command === '/start' || command === 'شروع' || !command) {
      await this.api.sendMessage(chatId, botHelpText(linked?.role ?? null), {
        reply_markup: roleKeyboard(this.miniAppUrl(), linked?.role ?? null),
      });
      return;
    }

    if (command === 'راهنما') {
      await this.api.sendMessage(chatId, botHelpText(linked?.role ?? null));
      return;
    }

    if (command === 'ارتباط با پشتیبانی') {
      await this.api.sendMessage(chatId, SUPPORT_CONTACT);
      return;
    }

    if (!linked) {
      await this.api.sendMessage(
        chatId,
        'ابتدا مینی‌اپ را باز کنید و با حساب خوان وارد شوید تا دستورها فعال شوند.',
        { reply_markup: roleKeyboard(this.miniAppUrl(), null) },
      );
      return;
    }

    if (command === 'سفارش‌های من') {
      await this.sendMyOrders(chatId, linked);
      return;
    }

    if (command === 'منوی جاری') {
      await this.sendCurrentMenu(chatId);
      return;
    }

    if (command === 'راهنمای منابع انسانی' && linked.role === Role.HR) {
      await this.api.sendMessage(
        chatId,
        'در مینی‌اپ می‌توانید فهرست کارکنان مجاز خود را ببینید. ایجاد، ویرایش و حذف حساب را در پنل وب انجام دهید.',
      );
      return;
    }

    if (command === 'پیگیری سفارش' && (linked.role === Role.SUPPORT || linked.role === Role.ADMIN)) {
      await this.api.sendMessage(
        chatId,
        'برای جست‌وجوی سفارش کارکنان، بخش پیگیری را در مینی‌اپ باز کنید. لغو یا ویرایش سفارش دیگران فقط در پنل وب و با دسترسی پشتیبانی انجام می‌شود.',
      );
      return;
    }

    if (command === 'گزارش عملیات' && (linked.role === Role.MANAGEMENT || linked.role === Role.ADMIN || linked.role === Role.SUPPORT)) {
      await this.api.sendMessage(
        chatId,
        'گزارش روزانه و ماهانه در مینی‌اپ و پنل وب از همان API گزارش‌ها خوانده می‌شود.',
      );
      return;
    }

    if (command === 'وضعیت سامانه' && linked.role === Role.ADMIN) {
      await this.api.sendMessage(
        chatId,
        'حذف کاربر، ساختمان، گروه و تنظیمات سامانه در مینی‌اپ در دسترس نیست. از پنل وب استفاده کنید.',
      );
      return;
    }

    await this.api.sendMessage(chatId, botHelpText(linked.role), {
      reply_markup: roleKeyboard(this.miniAppUrl(), linked.role),
    });
  }

  private normalizeCommand(text: string) {
    return text.replace(/@\S+$/, '').trim();
  }

  private async loadLinkedUser(
    chatId: string,
    from: Record<string, unknown> | null,
  ) {
    const baleUserId = typeof from?.id === 'number' ? from.id : null;
    const userId =
      (await this.links.findUserIdByChat(chatId)) ??
      (baleUserId !== null ? await this.links.findUserIdByBaleUser(baleUserId) : null);
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) return null;
    return user;
  }

  private async sendMyOrders(
    chatId: number,
    user: { id: string; username: string; role: Role; buildingId: string | null },
  ) {
    const listed = await this.orders.listMine(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        buildingId: user.buildingId,
        sessionId: 'bale',
        sessionExpiresAt: new Date(),
      },
      { page: 1, pageSize: 8, sortOrder: 'desc' },
    );
    if (!listed.items.length) {
      await this.api.sendMessage(chatId, 'سفارش فعالی در فهرست اخیر نیست.');
      return;
    }
    const lines = listed.items.slice(0, 8).map((item) => {
      const meal = item.mealType === 'LUNCH' ? 'ناهار' : 'شام';
      const title = item.currentCycle?.optionTitle ?? '—';
      const status = item.status === 'CANCELLED' ? 'لغو شده' : 'فعال';
      return `• ${item.jalaliDate ?? item.mealDate} ${meal} — ${title} (${status})`;
    });
    await this.api.sendMessage(
      chatId,
      `سفارش‌های اخیر شما:\n${lines.join('\n')}\n\nجزئیات و لغو مجاز در مینی‌اپ است.`,
    );
  }

  private async sendCurrentMenu(chatId: number) {
    const now = new Date();
    const jalali = gregorianToJalali(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
    );
    if (!jalali) {
      await this.api.sendMessage(chatId, 'تاریخ جاری نامعتبر است.');
      return;
    }
    try {
      const published = await this.menus.getPublished(jalali.year, jalali.month);
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const meals = Array.isArray(published.version?.meals)
        ? published.version.meals.filter((meal: { mealDate: string }) => meal.mealDate === today)
        : [];
      if (!meals.length) {
        await this.api.sendMessage(
          chatId,
          `منوی ${jalali.year}/${jalali.month} ذخیره شده، اما برای امروز غذایی نیست.`,
        );
        return;
      }
      const lines = meals.map((meal: { mealType: string; options: Array<{ title: string }> }) => {
        const label = meal.mealType === 'LUNCH' ? 'ناهار' : 'شام';
        const foods = meal.options.map((option) => option.title).join('، ');
        return `${label}: ${foods || '—'}`;
      });
      await this.api.sendMessage(chatId, `منوی امروز:\n${lines.join('\n')}`);
    } catch {
      await this.api.sendMessage(chatId, 'منوی این ماه هنوز در سامانه ذخیره نشده است.');
    }
  }
}
