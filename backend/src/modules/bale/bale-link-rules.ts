export type BaleLinkSnapshot = {
  khaanForBaleUser: string | null;
  baleForKhaanUser: string | null;
  khaanForChat: string | null;
};

export type BaleBindDecision =
  | { ok: true; idempotent: boolean }
  | { ok: false; code: 'bale_taken' | 'khaan_taken' | 'chat_taken' };

export function evaluateBaleBind(
  snapshot: BaleLinkSnapshot,
  khaanUserId: string,
  baleUserId: string,
): BaleBindDecision {
  const sameBale =
    snapshot.khaanForBaleUser === null ||
    snapshot.khaanForBaleUser === khaanUserId;
  const sameKhaan =
    snapshot.baleForKhaanUser === null ||
    snapshot.baleForKhaanUser === baleUserId;
  const sameChat =
    snapshot.khaanForChat === null || snapshot.khaanForChat === khaanUserId;

  if (!sameBale) {
    return { ok: false, code: 'bale_taken' };
  }
  if (!sameKhaan) {
    return { ok: false, code: 'khaan_taken' };
  }
  if (!sameChat) {
    return { ok: false, code: 'chat_taken' };
  }

  const idempotent =
    snapshot.khaanForBaleUser === khaanUserId &&
    snapshot.baleForKhaanUser === baleUserId &&
    (snapshot.khaanForChat === null || snapshot.khaanForChat === khaanUserId);

  return { ok: true, idempotent };
}

export function baleUserSettingKey(baleUserId: number | string) {
  return `bale.user.${baleUserId}`;
}

export function khaanUserSettingKey(khaanUserId: string) {
  return `bale.khaan.${khaanUserId}`;
}

export function baleChatSettingKey(chatId: string) {
  return `bale.chat.${chatId}`;
}
