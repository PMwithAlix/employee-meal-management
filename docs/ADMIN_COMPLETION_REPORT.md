# گزارش تکمیل پنل ADMIN — سامانه خوان

شاخه کار: `fix/employee-only-group-members`  
منطق عضویت فقط-کارمند از همین شاخه حفظ شد و دوباره نوشته نشد.

## ۱. صفحات ADMIN

| صفحه | قبل | بعد | API |
|---|---|---|---|
| نمای کلی | آمار Seed از Store | شمارش سفارش/مهمان/مهلت/audit زنده + شمارش سازمانی Users/Buildings/Groups | orders count, guest-orders, published menu, deadlines, audit, users, buildings, groups |
| کارکنان | Seed برای ADMIN | Live برای ADMIN و HR؛ ADMIN همه نقش‌ها | GET/POST/PATCH users، deactivate/reactivate، reset-password |
| ساختمان‌ها | Seed برای ADMIN | Live برای ADMIN و HR | GET/POST/PATCH buildings، PATCH users برای انتقال |
| گروه‌ها | Live (ADMIN+HR) | بدون بازنویسی؛ عضویت فقط EMPLOYEE فعال | groups + members + history + deactivate |
| مدیریت منو | Live | بدون تغییر قرارداد | menus, published-menus, excel import |
| سفارش کارکنان/مهمان | داخل مدیریت منو، Live | بدون تغییر | orders, guest-orders |
| مهلت وعده | DeadlineEditor Live | بدون تغییر | order-deadlines |
| گزارش‌ها | Live برای ADMIN | فیلتر کارمند فعال از همین شاخه | orders listAllManaged، users EMPLOYEE فعال |
| فعالیت | Live برای ADMIN | بدون تغییر | GET audit-logs |
| تنظیمات / رمز | Store و DEMO_PASSWORD | POST `/auth/change-password` سپس خروج | change-password، meal-settings |
| اعلان‌ها | Seed notes | بدون داده ساختگی؛ پیام نبود API | — |
| ظاهر (روشن/تیره) | localStorage | ترجیح UI محلی، داده کسب‌وکار نیست | — |

## ۲. APIهای استفاده‌شده

موجود: auth (login/me/logout/change-password)، users، buildings، groups، menus، published-menus، orders، guest-orders، order-deadlines، meal-settings، audit-logs.

## ۳. APIهای جدید

هیچ Endpoint جدیدی ساخته نشد.

## ۴. فایل‌های اصلی این تکمیل

- `docs/ADMIN_COMPLETION_AUDIT.md`
- `docs/ADMIN_COMPLETION_REPORT.md`
- `final-product/src/pages/Overview.tsx`
- `final-product/src/pages/Employees.tsx`
- `final-product/src/pages/Buildings.tsx`
- `final-product/src/pages/Settings.tsx`
- `final-product/src/components/Shell.tsx`
- `final-product/src/auth/client.ts` (+ test)
- `final-product/src/users/access.ts` (+ test)
- `final-product/src/users/client.ts`
- `final-product/src/buildings/access.ts` (+ test)
- `final-product/src/overview/useOrgDirectoryCounts.ts`
- `final-product/src/permissions.test.ts`
- حفظ‌شده از شاخه: `backend/src/groups/groups.access.ts`، `groups.service.ts`، e2e سازمان، `groups/access.ts`

## ۵. تست‌های اجراشده

| دستور | نتیجه |
|---|---|
| Frontend `npm test` | ۲۴ فایل، ۱۴۶ تست، موفق |
| Frontend `npm run build` (`tsc --noEmit && vite build`) | موفق |
| Backend `npm test` | ۱۹ سوئیت، ۶۶ تست، موفق |
| Backend `npm run build` | موفق |
| Backend e2e | اجرا نشد (نیاز به PostgreSQL e2e) |
| ورود واقعی ADMIN در مرورگر | اجرا نشد (نشست عملیاتی در این محیط نبود) |

## ۶. تکمیل‌شده

- حذف Seed عملیاتی از داشبورد، کارکنان و ساختمان ADMIN
- فیلتر و ایجاد نقش برای ADMIN مطابق Backend (`assertCanAssignRole`)
- HR همچنان محدود به نقش‌های مدیریت‌شده HR
- تغییر رمز واقعی و ابطال نشست
- عدم نمایش اعلان Seed
- عضویت گروه فقط EMPLOYEE فعال (UI + Backend)

## ۷. مسدود / پیاده‌نشده

- غیرفعال‌سازی ساختمان: Endpoint و فیلد `isActive` نیست؛ Schema تغییر داده نشد.
- اعلان‌ها: مدل Prisma هست، API خواندن/علامت‌خوانده نیست؛ UI ساختگی ساخته نشد.
- تنظیمات سیستم عمومی: فقط ساعت وعده (`meal-settings`) وجود دارد.
- `POST /auth/logout-all` هنوز از UI جداگانه صدا زده نمی‌شود؛ تغییر رمز همه نشست‌ها را باطل می‌کند.
- داشبورد HR همچنان Seed است (خارج از محدوده ADMIN).
- صفحات گزارش/فعالیت هنوز پیاده‌سازی Seed برای نقش بدون `usesLiveOrganizationData` دارند؛ ADMIN آن مسیر را نمی‌بیند.

## ۸. Build نهایی

- Frontend: موفق
- Backend: موفق

## جدول وضعیت

| قابلیت | وضعیت |
|---|---|
| داشبورد ADMIN زنده | COMPLETED |
| کارکنان ADMIN زنده + نقش‌ها | COMPLETED |
| ساختمان ADMIN زنده (ایجاد/ویرایش/انتقال) | COMPLETED |
| غیرفعال‌سازی ساختمان | BLOCKED (بدون API/Schema) |
| گروه‌ها + عضویت EMPLOYEE | COMPLETED |
| منو، نسخه، انتشار | COMPLETED (از قبل Live) |
| سفارش کارکنان و مهمان | COMPLETED (از قبل Live) |
| مهلت وعده | COMPLETED (از قبل Live) |
| گزارش‌ها | COMPLETED |
| Audit | COMPLETED |
| تغییر رمز | COMPLETED |
| اعلان‌ها | BLOCKED (بدون API خواندنی) |
| تنظیمات سیستم عمومی | NOT IMPLEMENTED (قرارداد محصولی وجود ندارد) |
