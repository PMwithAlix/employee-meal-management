import { normalizeBuildingName } from './building-name';

describe('normalizeBuildingName', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeBuildingName('  دهقان   شمالی  ')).toBe('دهقان شمالی');
  });
});
