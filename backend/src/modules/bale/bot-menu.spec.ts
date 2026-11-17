import { Role } from '@prisma/client';
import { roleKeyboard } from './bot-menu';

describe('roleKeyboard', () => {
  it('opens the Mini App with the official web_app button field', () => {
    const keyboard = roleKeyboard('https://food.kavosh.site/mini-app', Role.EMPLOYEE);
    expect(keyboard.keyboard[0][0]).toEqual({
      text: 'مشاهده منو و ثبت سفارش',
      web_app: { url: 'https://food.kavosh.site/mini-app' },
    });
  });

  it('adds an HR-specific action without exposing admin purge commands', () => {
    const hr = roleKeyboard('https://example.test/mini-app', Role.HR);
    const labels = hr.keyboard.flat().map((item) => item.text);
    expect(labels).toContain('راهنمای منابع انسانی');
    expect(labels.join(' ')).not.toMatch(/حذف/);
  });
});
