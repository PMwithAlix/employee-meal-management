import { JALALI_MONTHS } from '../../../shared/lib/jalali'

export function defaultMenuAnnouncementCopy(jalaliMonth: number) {
  const monthName = JALALI_MONTHS[jalaliMonth - 1]
  return {
    title: `منوی ${monthName} منتشر شد 🍽️`,
    body: 'برای مشاهده منو و ثبت وعده‌های غذایی، وارد سامانه شوید.',
  }
}
