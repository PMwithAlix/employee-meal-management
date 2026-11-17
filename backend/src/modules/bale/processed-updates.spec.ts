import { ProcessedUpdates } from './processed-updates';

describe('ProcessedUpdates', () => {
  it('accepts an id once and rejects repeats', () => {
    const seen = new ProcessedUpdates(3);
    expect(seen.remember(10)).toBe(true);
    expect(seen.remember(10)).toBe(false);
    expect(seen.remember(11)).toBe(true);
  });
});
