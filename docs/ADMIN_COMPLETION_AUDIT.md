# ممیزی تکمیل پنل ADMIN — سامانه خوان

تاریخ بررسی: ۱۴ نوامبر ۲۰۲۶  
شاخه: `fix/employee-only-group-members` (`1450116`)  
`main`: `de72783` — Connect ADMIN group management to live APIs  
وضعیت Git در زمان ممیزی: کاری درختی تمیز؛ تغییرات عضویت فقط-کارمند روی همین شاخه حفظ می‌شود.

## صفحات و Routeهای ADMIN

منبع ناوبری: `PAGE_ACCESS.admin` و `Shell` (`PAGES`).

| صفحه UI | شناسه | پیاده‌سازی | اتصال عملیاتی در شروع ممیزی |
|---|---|---|---|
| نمای کلی | `overview` | `AdminOverview` | Seed: `app.employees/buildings/orders/groups` |
| مدیریت منو | `menuMgmt` | `MenuManagementPage` | Live: منو، مهلت، مهمان، سفارش کارکنان |
| گزارش‌ها | `reports` | `LiveReportsPage` (`usesLiveOrganizationData`) | Live |
| فعالیت | `activity` | `AuditActivityPage` | Live |
| کارکنان | `employees` | `SeedEmployeesPage` برای غیر HR | Seed برای ADMIN |
| ساختمان‌ها | `buildings` | `SeedBuildingsPage` برای غیر HR | Seed برای ADMIN |
| گروه‌ها | `groups` | `LiveGroupsPage` | Live برای ADMIN و HR |
| تنظیمات | `settings` | فرم رمز محلی + ساعت وعده API | رمز Seed؛ وعده Live |

صفحات خارج از ناوبری ADMIN: منوی ماهانه و سفارش شخصی (`menu`, `orders`) فقط EMPLOYEE/HR/SUPPORT.

محافظت Route: `canAccess` در `setPage` و فیلتر سایدبار. نقش DEV فقط در `import.meta.env.DEV`.

## APIهای موجود (بک‌اند)

- Auth: login, logout, me, **change-password**, logout-all
- Users: CRUD جزئی، deactivate/reactivate، reset-password — ADMIN و HR
- Buildings: create, list, get, patch name — **بدون deactivate**
- Groups: list/get/create/patch/deactivate/members/history — محدودیت EMPLOYEE روی همین شاخه
- Menus / published-menus
- Orders, guest-orders, order-deadlines, meal-settings
- Ratings
- Audit logs
- Health

## APIهای مفقود / خارج از محدوده Schema

- **Notifications:** مدل Prisma هست؛ کنترلر/سرویس خواندن و علامت‌خوانده وجود ندارد. بدون Endpoint جدید و بدون Migration.
- **غیرفعال‌سازی ساختمان:** فیلد `isActive` و Endpoint نیست.
- **تنظیمات سیستم عمومی:** فقط `meal-settings` (ساعت وعده). کلید/پیکربندی سراسری دیگر نیست.

## مشکلات کشف‌شده (ADMIN)

1. داشبورد ADMIN عدد Seed نشان می‌دهد.
2. کارکنان و ساختمان‌ها برای ADMIN هنوز Store محلی‌اند.
3. فرم کارمند Live فقط نقش EMPLOYEE می‌سازد؛ فیلتر نقش فقط `HR_MANAGED_ROLES` است — برای ADMIN کافی نیست.
4. انتقال ساختمان Live فقط نقش‌های HR-managed را نشان می‌دهد.
5. تغییر رمز در تنظیمات `DEMO_PASSWORD` و Store است؛ `POST /auth/change-password` سیم نشده.
6. زنگوله اعلان‌ها از `createSnapshot().notes` می‌آید.
7. غیرفعال‌سازی ساختمان در Backend وجود ندارد (Blocked).
8. اعلان‌ها بدون API خواندنی (Blocked — بدون UI ساختگی).

## برنامه اجرا

1. حفظ منطق `isEligibleGroupCandidate` / `assertEligibleGroupMemberRole`.
2. مسیر ADMIN+HR به صفحات Live کارکنان و ساختمان.
3. داشبورد ADMIN از شمارش سفارش، مهمان، مهلت، audit و فهرست‌های سازمانی.
4. فیلتر/فرم نقش برای ADMIN مطابق `assertCanAssignRole`.
5. اتصال فرم رمز به Backend و خروج پس از موفقیت (ابطال نشست).
6. حذف نمایش Seed اعلان؛ پیام صادقانه نبود API.
7. تست و Build فرانت و بک‌اند.
