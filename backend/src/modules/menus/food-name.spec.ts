import { normalizeFoodName } from './food-name';

describe('normalizeFoodName', () => {
  it('treats zwnj, extra spaces, and arabic letters as the same food', () => {
    const canonical = normalizeFoodName('زرشک‌پلو با مرغ');
    expect(normalizeFoodName('زرشک پلو با مرغ')).toBe(canonical);
    expect(normalizeFoodName('  زرشک‌پلو  با مرغ  ')).toBe(canonical);
    expect(normalizeFoodName('زرشك‌پلو با مرغ')).toBe(canonical);
  });

  it('does not collapse genuinely different titles', () => {
    expect(normalizeFoodName('جوجه کباب')).not.toBe(
      normalizeFoodName('جوجه کباب با برنج'),
    );
  });
});
