import { Role } from '@prisma/client';

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: 'کارمند',
  HR: 'منابع انسانی',
  SUPPORT: 'پشتیبانی',
  MANAGEMENT: 'مدیریت',
  ADMIN: 'مدیر سامانه',
};

export function botHelpText(role: Role | null) {
  const intro =
    'سامانه خوان — سفارش غذای سازمانی.\nاز دکمه‌ها برای ورود به مینی‌اپ یا مشاهده وضعیت استفاده کنید.';
  if (!role) {
    return `${intro}\n\nهنوز حساب خوان به بله متصل نشده. مینی‌اپ را باز کنید و با نام کاربری سامانه وارد شوید.`;
  }
  return `${intro}\n\nنقش شما: ${ROLE_LABEL[role]}`;
}

export function roleKeyboard(miniAppUrl: string, role: Role | null) {
  const openMiniApp = {
    text: 'مشاهده منو و ثبت سفارش',
    web_app: { url: miniAppUrl },
  };
  const rows: Array<Array<{ text: string; web_app?: { url: string } }>> = [
    [openMiniApp],
    [{ text: 'سفارش‌های من' }, { text: 'منوی جاری' }],
  ];

  if (role === Role.HR) {
    rows.push([{ text: 'راهنمای منابع انسانی' }]);
  } else if (role === Role.SUPPORT) {
    rows.push([{ text: 'پیگیری سفارش' }]);
  } else if (role === Role.MANAGEMENT) {
    rows.push([{ text: 'گزارش عملیات' }]);
  } else if (role === Role.ADMIN) {
    rows.push([{ text: 'وضعیت سامانه' }]);
  }

  rows.push([{ text: 'راهنما' }, { text: 'ارتباط با پشتیبانی' }]);
  return {
    keyboard: rows,
    resize_keyboard: true,
  };
}

export const SUPPORT_CONTACT =
  'برای پیگیری حساب کاربری با واحد منابع انسانی و برای خطای سامانه با پشتیبانی سازمان تماس بگیرید. جزئیات سفارش را فقط در مینی‌اپ یا پنل وب مشاهده کنید.';
