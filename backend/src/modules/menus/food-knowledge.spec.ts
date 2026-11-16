import { Prisma } from '@prisma/client';
import { classifyMenuItem, rememberFoodClassification } from './food-knowledge';
import { normalizeFoodName } from './food-name';

function knowledgeStore() {
  const rows = new Map<string, { title: string; isRice: boolean }>();
  const tx = {
    foodKnowledge: {
      async findUnique({ where }: { where: { normalizedName: string } }) {
        const row = rows.get(where.normalizedName);
        return row ? { ...row, normalizedName: where.normalizedName } : null;
      },
      async upsert({
        where,
        create,
        update,
      }: {
        where: { normalizedName: string };
        create: { title: string; normalizedName: string; isRice: boolean };
        update: { title: string; isRice?: boolean };
      }) {
        const current = rows.get(where.normalizedName);
        if (!current) {
          rows.set(where.normalizedName, {
            title: create.title,
            isRice: create.isRice,
          });
          return;
        }
        rows.set(where.normalizedName, {
          title: update.title,
          isRice: update.isRice ?? current.isRice,
        });
      },
      async update({
        where,
        data,
      }: {
        where: { normalizedName: string };
        data: { title: string; isRice: boolean };
      }) {
        rows.set(where.normalizedName, data);
      },
    },
  };
  return { rows, tx: tx as unknown as Prisma.TransactionClient };
}

describe('classifyMenuItem', () => {
  it('defaults unknown foods to non-rice and remembers an explicit rice toggle', async () => {
    const { rows, tx } = knowledgeStore();
    expect(await classifyMenuItem(tx, { title: 'زرشک‌پلو با مرغ' })).toBe(false);
    expect(rows.get(normalizeFoodName('زرشک پلو با مرغ'))?.isRice).toBe(false);

    expect(
      await classifyMenuItem(tx, {
        title: 'زرشک پلو با مرغ',
        previousNormalized: normalizeFoodName('زرشک‌پلو با مرغ'),
        previousIsRice: false,
        requestedIsRice: true,
      }),
    ).toBe(true);
    expect(rows.get(normalizeFoodName('زرشک‌پلو با مرغ'))?.isRice).toBe(true);
  });

  it('restores remembered rice and does not treat a longer name as the same food', async () => {
    const { tx } = knowledgeStore();
    await rememberFoodClassification(tx, 'جوجه کباب', true, true);
    expect(await classifyMenuItem(tx, { title: 'جوجه کباب' })).toBe(true);
    expect(await classifyMenuItem(tx, { title: 'جوجه کباب با برنج' })).toBe(
      false,
    );
  });
});
