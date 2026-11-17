import { evaluateBaleBind } from './bale-link-rules';

const empty = {
  khaanForBaleUser: null,
  baleForKhaanUser: null,
  khaanForChat: null,
};

describe('evaluateBaleBind', () => {
  it('allows the first binding', () => {
    expect(evaluateBaleBind(empty, 'khaan-1', '42')).toEqual({
      ok: true,
      idempotent: false,
    });
  });

  it('allows reconnecting the same pair', () => {
    expect(
      evaluateBaleBind(
        {
          khaanForBaleUser: 'khaan-1',
          baleForKhaanUser: '42',
          khaanForChat: 'khaan-1',
        },
        'khaan-1',
        '42',
      ),
    ).toEqual({ ok: true, idempotent: true });
  });

  it('rejects a Bale user already bound to another Khaan account', () => {
    expect(
      evaluateBaleBind(
        { ...empty, khaanForBaleUser: 'khaan-2' },
        'khaan-1',
        '42',
      ),
    ).toEqual({ ok: false, code: 'bale_taken' });
  });

  it('rejects a Khaan user already bound to another Bale account', () => {
    expect(
      evaluateBaleBind(
        { ...empty, baleForKhaanUser: '99' },
        'khaan-1',
        '42',
      ),
    ).toEqual({ ok: false, code: 'khaan_taken' });
  });

  it('rejects a chat bound to another Khaan account', () => {
    expect(
      evaluateBaleBind(
        { ...empty, khaanForChat: 'khaan-2' },
        'khaan-1',
        '42',
      ),
    ).toEqual({ ok: false, code: 'chat_taken' });
  });
});
