import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  baleChatSettingKey,
  baleUserSettingKey,
  evaluateBaleBind,
  khaanUserSettingKey,
} from './bale-link-rules';

const BIND_CONFLICT: Record<
  'bale_taken' | 'khaan_taken' | 'chat_taken',
  string
> = {
  bale_taken: 'این حساب بله به کاربر دیگری در خوان متصل است. با پشتیبانی تماس بگیرید.',
  khaan_taken: 'این حساب خوان قبلاً به حساب بله دیگری متصل شده است.',
  chat_taken: 'این گفتگوی بله به کاربر دیگری در خوان متصل است.',
};

@Injectable()
export class BaleLinkStore {
  constructor(private readonly prisma: PrismaService) {}

  async bind(khaanUserId: string, baleUserId: number, chatId?: string | null) {
    const baleId = String(baleUserId);
    const chat = chatId?.trim() || baleId;
    await this.runSerializable(() => this.bindOnce(khaanUserId, baleId, chat));
  }

  async findUserIdByChat(chatId: string) {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: baleChatSettingKey(chatId) },
    });
    return row?.value ?? null;
  }

  async findUserIdByBaleUser(baleUserId: number) {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: baleUserSettingKey(baleUserId) },
    });
    return row?.value ?? null;
  }

  private async bindOnce(
    khaanUserId: string,
    baleId: string,
    chatId: string,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const [khaanForBaleUser, baleForKhaanUser, khaanForChat] =
          await Promise.all([
            tx.systemSetting.findUnique({
              where: { key: baleUserSettingKey(baleId) },
            }),
            tx.systemSetting.findUnique({
              where: { key: khaanUserSettingKey(khaanUserId) },
            }),
            tx.systemSetting.findUnique({
              where: { key: baleChatSettingKey(chatId) },
            }),
          ]);

        const decision = evaluateBaleBind(
          {
            khaanForBaleUser: khaanForBaleUser?.value ?? null,
            baleForKhaanUser: baleForKhaanUser?.value ?? null,
            khaanForChat: khaanForChat?.value ?? null,
          },
          khaanUserId,
          baleId,
        );
        if (!decision.ok) {
          throw new ConflictException(BIND_CONFLICT[decision.code]);
        }

        await this.upsertSetting(
          tx,
          baleUserSettingKey(baleId),
          khaanUserId,
          khaanUserId,
        );
        await this.upsertSetting(
          tx,
          khaanUserSettingKey(khaanUserId),
          baleId,
          khaanUserId,
        );
        await this.upsertSetting(
          tx,
          baleChatSettingKey(chatId),
          khaanUserId,
          khaanUserId,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async runSerializable(work: () => Promise<void>) {
    try {
      await work();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        await work();
        return;
      }
      throw error;
    }
  }

  private async upsertSetting(
    tx: Prisma.TransactionClient,
    key: string,
    value: string,
    khaanUserId: string,
  ) {
    await tx.systemSetting.upsert({
      where: { key },
      create: { key, value, updatedBy: khaanUserId },
      update: { value, updatedBy: khaanUserId },
    });
  }
}
