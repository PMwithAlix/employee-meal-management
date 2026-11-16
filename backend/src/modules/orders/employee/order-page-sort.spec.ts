import { orderPageOrderBy } from './order-page-sort';

describe('orderPageOrderBy', () => {
  it('keeps a stable secondary id order when createdAt ties', () => {
    expect(orderPageOrderBy('desc')).toEqual([
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
    expect(orderPageOrderBy('asc')).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  });
});
