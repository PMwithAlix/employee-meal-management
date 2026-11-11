# فهرست قابلیت‌ها

وضعیت‌ها فقط پس از ردیابی UI → سرویس → persistence ثبت شده‌اند.

---

## ماژول احراز هویت

### F-01 ورود
- **نقش:** همه
- **پیش‌شرط:** حساب در `Users`
- **ورودی:** `username`, `password` فرم POST
- **خروجی:** کوکی و ریدایرکت `/dashboard` یا `/change-password` یا خطا
- **اقدامات:** ارسال فرم، نمایش خطا `err` / `locked`
- **قواعد:** BR-19, BR-20, BR-28
- **موجودیت:** `User`, `LoginResult`
- **فرانت:** `Pages/Login.razor`
- **بک‌اند:** `Program.cs` `MapPost("/login")`, `UserService.LoginAsync`
- **API:** `POST /login` (form)
- **وضعیت:** Fully Implemented

### F-02 خروج
- **فرانت:** لینک `/logout` در `MainLayout.razor`
- **API:** `GET /logout`
- **وضعیت:** Fully Implemented

### F-03 قفل حساب
- **بک‌اند:** `UserService.LoginAsync`
- **وضعیت:** Fully Implemented

### F-04 اجبار تغییر رمز اولیه
- **محرک:** هش معادل `1234`
- **وضعیت:** Partially Implemented (ریدایرکت هست؛ قفل سایر صفحات بعد از ورود نیست)

### F-05 تغییر رمز
- **نقش:** هر کاربر لاگین‌شده (لینک برای مسئول دفتر در منوی پروفایل مخفی است)
- **ورودی:** رمز فعلی، جدید، تکرار
- **فرانت:** `Pages/ChangePassword.razor`
- **بک‌اند:** `UserService.ChangePasswordAsync`
- **وضعیت:** Fully Implemented برای مسیر اختیاری؛ `[Authorize]` روی صفحه نیست

---

## ماژول داشبورد

### F-06 داشبورد ورود
- **نقش:** هر کاربر احرازشده
- **خروجی:** نام، نقش، StaticIP، آخرین/فعلی ورود، آخرین شکست
- **فرانت:** `Pages/Dashboard.razor` `[Authorize]`
- **بک‌اند:** `UserService.GetUserByIdAsync`
- **وضعیت:** Fully Implemented (نمایش). غیرفعال‌سازی DevTools در `OnAfterRender` با `eval` هست و به محصول غذا مربوط نیست.

---

## ماژول رزرو کارمند (محافظت‌شده)

### F-07 انتخاب ماهانه غذا
- **نقش اصلی:** `کاربر`
- **پیش‌شرط:** لاگین؛ منوی روز برای گزینه‌ها (بدون منو سلکت خالی است)
- **ورودی:** انتخاب از `<select>` ناهار/شام برای هر روز ماه شمسی
- **خروجی:** رکورد `FoodReservation`؛ alert در خطا
- **اقدامات:** ماه قبل/بعد، تغییر سلکت (ذخیره آنی)، حذف وعده، چاپ
- **قواعد:** BR-01 تا BR-11, BR-15, BR-16
- **فرانت:** `Pages/UserReserve.razor`
- **بک‌اند:** `MenuService.GetMenusForMonth`, `FoodReservationService.GetReservationsForUserAndDates`, `SaveOrUpdateAsync`
- **API:** ندارد (مدار Blazor)
- **وضعیت:** Fully Implemented

### F-08 حذف وعده توسط کارمند
- دکمه سطل کنار سلکت اگر `canEdit*` و مقدار غیرخالی
- ذخیره با `Lunch` یا `Dinner` خالی
- **وضعیت:** Fully Implemented با اعمال مهلت سرور

### F-09 امتیاز و نظر غذا
- **فرانت/بک‌اند:** `UserReserve.SaveRating` → `SaveRatingAsync`
- **وضعیت:** Fully Implemented با اختلاف ساعت ناهار UI/سرور (BR-14)

### F-10 چاپ جدول ماه کارمند
- `PrintMonth` با `eval` و `window.print`
- سلکت‌ها به متن تبدیل می‌شوند
- **وضعیت:** Fully Implemented در حد چاپ مرورگر

### F-11 نمایش رنگ روز (امروز، گذشته، تعطیل، آخر هفته)
- فقط CSS
- **وضعیت:** Fully Implemented به‌عنوان نمایش؛ تعطیل رزرو را نمی‌بندد

---

## ماژول منو

### F-12 ویرایش منوی ماه
- **نقش:** پشتیبانی (ذخیره)؛ مدیریت (مشاهده)
- **ورودی:** متن آزاد Lunch1-3, Dinner1-2؛ سال/ماه شمسی ۱۴۰۰–۱۴۵۰
- **فرانت:** `Pages/MenuManagement.razor`
- **بک‌اند:** `MenuService.GetMenusForMonth`, `SaveOrUpdateAsync`
- **وضعیت:** Fully Implemented برای نام غذاها در محدودیت تاریخ BR-17

### F-13 پرچم تعطیل و رمضان
- UI چک‌باکس دارد
- persist در update رکورد موجود انجام نمی‌شود (BR-18)
- **وضعیت:** Partially Implemented

### F-14 مشاهده میانگین امتیاز و نظرات در منو
- محاسبه‌ای در `MenuService`
- **وضعیت:** Fully Implemented برای خواندن؛ نظرات در `<select>` فقط‌خواندنی

---

## ماژول عملیات و گزارش پشتیبانی

### F-15 گزارش سفارش روزانه به‌تفکیک دپارتمان
- **نقش:** پشتیبانی
- **فرانت:** بخش‌های collapsible در `FoodReservations.razor`
- **بک‌اند:** `ReservationServiceImpl.GetDailyOrders`
- **وضعیت:** Fully Implemented

### F-16 لیست ناهار/شام رستوران (تجمیع تعداد)
- `GetDailySummary`
- **وضعیت:** Fully Implemented شامل قاعده گارد BR-12

### F-17 گزارش ماهانه تعداد ناهار/شام هر کاربر
- حلقه روی همه روزهای ماه و `GetDailyOrders` (سمت سرور مدار)
- **وضعیت:** Fully Implemented از نظر خروجی؛ عملکردی سنگین است اما خارج از محدوده این ممیزی

### F-18 افزودن غذای مهمان
- `UserId = 129`, تعداد با input عددی
- **وضعیت:** Fully Implemented وابسته به وجود کاربر ۱۲۹ در DB (Requires Business Confirmation)

### F-19 افزودن غذا برای کاربر
- لیست کاربران بدون `مهمان` و بدون `Guards-` و بدون وعده پر همان روز
- **وضعیت:** Fully Implemented در UI؛ شکست بی‌پیام اگر وعده از قبل پر باشد

### F-20 حذف نرم وعده
- confirm جاوااسکریپت سپس `SoftDeleteMealAsync`
- **وضعیت:** Fully Implemented برای پشتیبانی

### F-21 چاپ گزارش‌ها
- `printSection` و `printHtml` در همان صفحه؛ همچنین `printSection` سراسری در `_Host.cshtml`
- قالب A5 برای روزانه، A4 landscape برای ماه
- **وضعیت:** Fully Implemented در حد چاپ مرورگر؛ فایل export مثل Excel نیست

---

## ماژول کاربران

### F-22 فهرست و جستجوی کاربران
- دو جدول مدیران / کاربران
- **وضعیت:** Fully Implemented

### F-23 ایجاد کاربر
- **وضعیت:** Fully Implemented با ناهماهنگی حداقل طول رمز UI در برابر Annotation

### F-24 ویرایش کاربر
- نام کاربری disabled
- **وضعیت:** Fully Implemented

### F-25 حذف کاربر
- **وضعیت:** Fully Implemented در UI با منع مسئول دفتر؛ بدون منع سروری نقش

### F-26 بازنشانی رمز به 1234
- **وضعیت:** Fully Implemented

### F-27 بازنشانی IP
- **وضعیت:** Fully Implemented (`StaticIP = null`)

---

## سایر

### F-28 دانلود گواهی و PDF نصب
- لینک استاتیک `/install/ca.cert.crt` و PDF
- **وضعیت:** Fully Implemented به‌عنوان فایل استاتیک

### F-29 اعلان / SignalR
- `AddSignalR`, اسکریپت `signalr.min.js`, ارجاع `notifications.js`, `UnreadCount` در layout که همیشه ۰ می‌ماند
- **وضعیت:** Partially Implemented / عملاً UI Only ناقص (فایل JS 404)

### F-30 EncryptionService
- کلاس هست؛ فراخوانی ندارد
- **وضعیت:** Disabled / Unused

### F-31 مدل Print
- کلاس خالی
- **وضعیت:** Deprecated / Stub

---

## شمارش

| وضعیت | تعداد Feature ID |
|---|---|
| Fully Implemented | 26 (F-01,02,03,05,06,07,08,09,10,11,12,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28) |
| Partially Implemented | 3 (F-04, F-13, F-29) |
| Unused/Stub | 2 (F-30, F-31) |
