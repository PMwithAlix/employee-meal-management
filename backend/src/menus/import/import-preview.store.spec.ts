import { ImportPolicy } from '../menu.types';
import { assertPolicy, ImportImpact } from './import-preview.store';

const emptyImpact = (): ImportImpact => ({
  matches: [],
  unmatchedPublished: [],
  unmatchedImported: [],
  ambiguous: [],
  activeOrderCount: 0,
  atRiskOrderCount: 0,
  atRiskOrders: [],
});

describe('assertPolicy', () => {
  it('allows Keep Existing Orders even with unmatched options', () => {
    const impact = emptyImpact();
    impact.unmatchedImported.push({
      title: 'جدید',
      mealType: 'LUNCH',
      mealDate: '2026-08-23',
    });
    expect(assertPolicy(ImportPolicy.KeepExistingOrders, impact)).toBe('');
  });

  it('rejects Exact Match Only when options are unmatched or ambiguous', () => {
    const unmatched = emptyImpact();
    unmatched.unmatchedPublished.push({
      publishedItemId: 'a',
      title: 'قدیمی',
      mealType: 'LUNCH',
      mealDate: '2026-08-23',
    });
    expect(assertPolicy(ImportPolicy.ExactMatchOnly, unmatched)).not.toBe('');
    const ambiguous = emptyImpact();
    ambiguous.ambiguous.push({
      title: 'کباب',
      mealType: 'LUNCH',
      mealDate: '2026-08-23',
      reason: 'تطبیق غیریکتا',
    });
    expect(assertPolicy(ImportPolicy.ExactMatchOnly, ambiguous)).not.toBe('');
  });

  it('rejects Reset when orders would lose their option reference', () => {
    const impact = emptyImpact();
    impact.atRiskOrderCount = 1;
    impact.atRiskOrders.push({
      orderCycleId: 'c',
      menuItemId: 'i',
      title: 'کباب',
    });
    expect(assertPolicy(ImportPolicy.Reset, impact)).not.toBe('');
  });
});
