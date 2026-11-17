import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const userKey = (baleUserId: number) => `bale.user.${baleUserId}`;
const chatKey = (chatId: string) => `bale.chat.${chatId}`;

@Injectable()
export class BaleLinkStore {
  constructor(private readonly prisma: PrismaService) {}

  async bind(khaanUserId: string, baleUserId: number, chatId?: string | null) {
    await this.upsertExclusive(userKey(baleUserId), khaanUserId);
    if (chatId) {
      await this.upsertExclusive(chatKey(chatId), khaanUserId);
    }
  }

  async findUserIdByChat(chatId: string) {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: chatKey(chatId) },
    });
    return row?.value ?? null;
  }

  async findUserIdByBaleUser(baleUserId: number) {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: userKey(baleUserId) },
    });
    return row?.value ?? null;
  }

  private async upsertExclusive(key: string, khaanUserId: string) {
    const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (existing && existing.value !== khaanUserId) {
      throw new ConflictException(
        'این حساب بله به کاربر دیگری در خوان متصل است. با پشتیبانی تماس بگیرید.',
      );
    }
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: khaanUserId,
        updatedBy: khaanUserId,
      },
      update: {
        value: khaanUserId,
        updatedBy: khaanUserId,
      },
    });
  }
}
