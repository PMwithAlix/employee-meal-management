import { defaultMenuAnnouncementCopy } from './menu.types';

describe('defaultMenuAnnouncementCopy', () => {
  it('uses the Jalali month name of the selected month', () => {
    expect(defaultMenuAnnouncementCopy(8)).toEqual({
      title: 'منوی آبان آماده است 🍽️',
      body: 'برای مشاهده منو و ثبت وعده‌های غذایی وارد سامانه شوید.',
    });
  });
});
