import { Prisma } from '@prisma/client';
import { normalizeFoodName } from './food-name';

export async function lookupFoodRice(
  tx: Prisma.TransactionClient,
  title: string,
) {
  const normalizedName = normalizeFoodName(title);
  if (!normalizedName) return null;
  const row = await tx.foodKnowledge.findUnique({ where: { normalizedName } });
  return row ? row.isRice : null;
}

export async function rememberFoodClassification(
  tx: Prisma.TransactionClient,
  title: string,
  isRice: boolean,
  overwrite: boolean,
) {
  const normalizedName = normalizeFoodName(title);
  if (!normalizedName) return;
  const display = title.replace(/\s+/g, ' ').trim();
  try {
    await tx.foodKnowledge.upsert({
      where: { normalizedName },
      create: { title: display, normalizedName, isRice },
      update: overwrite ? { isRice, title: display } : { title: display },
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      throw error;
    }
    if (overwrite) {
      await tx.foodKnowledge.update({
        where: { normalizedName },
        data: { isRice, title: display },
      });
    }
  }
}

export async function classifyMenuItem(
  tx: Prisma.TransactionClient,
  input: {
    title: string;
    previousNormalized?: string;
    previousIsRice?: boolean;
    requestedIsRice?: boolean;
  },
) {
  const normalized = normalizeFoodName(input.title);
  const titleChanged =
    input.previousNormalized !== undefined &&
    input.previousNormalized !== normalized;

  if (!titleChanged && input.requestedIsRice !== undefined) {
    await rememberFoodClassification(
      tx,
      input.title,
      input.requestedIsRice,
      true,
    );
    return input.requestedIsRice;
  }

  if (
    !titleChanged &&
    input.requestedIsRice === undefined &&
    input.previousIsRice !== undefined
  ) {
    await rememberFoodClassification(
      tx,
      input.title,
      input.previousIsRice,
      false,
    );
    return input.previousIsRice;
  }

  const known = await lookupFoodRice(tx, input.title);
  const isRice = known ?? false;
  await rememberFoodClassification(tx, input.title, isRice, false);
  return isRice;
}
