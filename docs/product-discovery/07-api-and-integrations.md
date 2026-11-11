# API و یکپارچگی‌ها

معماری فعلی **Blazor Server** است. عملیات رزرو، منو و کاربر از مدار SignalR داخلی Blazor (`/_blazor`) به سرویس‌های Scoped می‌روند، نه REST JSON.

HTTPهای صریح محصول بسیار کم‌اند. قرارداد جعل نشده است.

---

## ۱. نقاط انتهایی HTTP

### `POST /login`

- **منبع:** `Program.cs` ۷۵–۱۱۱
- **مصرف‌کننده:** فرم `Login.razor` ۱۲۶–۱۳۶
- **Content:** `application/x-www-form-urlencoded` فیلدهای `username`, `password`
- **احراز:** ندارد (عمومی)
- **منطق:** `UserService.LoginAsync(username, password, clientIp)`
- **پاسخ:** همیشه Redirect (نه JSON)

| نتیجه | Status عملی | Location |
|---|---|---|
| شکست یا فیلد خالی | 302 | `/login?err=1` |
| قفل | 302 | `/login?locked=1&until={yyyy-MM-ddTHH:mm}` |
| موفق + must change | 302 + Set-Cookie | `/change-password` |
| موفق | 302 + Set-Cookie | `/dashboard` |

بدنه JSON خطا تعریف نشده است.

### `GET /logout`

- **منبع:** `Program.cs` ۱۱۲–۱۱۶
- **مصرف:** لینک پروفایل
- **اثر:** `SignOutAsync` سپس `/login`

### مدار Blazor

- `MapBlazorHub()` → `/_blazor` negotiate و CONNECT
- `MapFallbackToPage("/_Host")` برای مسیرهای UI
- احراز صفحات با `[Authorize]` در مدار (در صورت فعال بودن زیرساخت Authorization)

### `MapControllers()`

کنترلر در پروژه نیست. **Verified:** endpoint MVC اختصاصی محصول وجود ندارد.

---

## ۲. عملیات بک‌اند معادل «API داخلی»

این‌ها قرارداد HTTP نیستند؛ متدهای سرویس‌اند که صفحات صدا می‌زنند.

| عملیات کسب‌وکار | متد | ورودی اصلی | خروجی/خطا |
|---|---|---|---|
| ورود | `UserService.LoginAsync` | username, password, ip | `LoginResult?` |
| لیست کاربران | `GetAllUsersAsync` | — | `List<User>` |
| کاربر با Id | `GetUserByIdAsync` | userId | `User?` |
| ایجاد کاربر | `AddUserAsync` | `UserInputModel` | استثنا تکراری/خالی |
| ویرایش کاربر | `UpdateUserAsync` | `User` | استثنا یافت نشد |
| حذف کاربر | `DeleteUserAsync` | userId | استثنا یافت نشد |
| ریست رمز | `ResetPasswordAsync` | userId, password | |
| ریست IP | `ResetIPAsync` | userId, ip | |
| تغییر رمز | `ChangePasswordAsync` | userId, current?, new | bool |
| منوی ماه | `MenuService.GetMenusForMonth` | سال/ماه شمسی | لیست + آمار محاسبه‌ای |
| ذخیره منو | `SaveOrUpdateAsync(DailyMenu)` | منو روز | void |
| رزروهای کاربر در تاریخ‌ها | `GetReservationsForUserAndDates` | userId, dates | لیست |
| ذخیره رزرو | `FoodReservationService.SaveOrUpdateAsync` | `FoodReservation` | استثنای مهلت |
| امتیاز | `SaveRatingAsync` | id, userId, meal, rating, comment | استثنا اعتبارسنجی |
| حذف نرم | `SoftDeleteMealAsync` | reservationId, "Lunch"\|"Dinner" | void (اگر نباشد return) |
| خلاصه روز | `GetDailySummary` | date | `DailyFoodSummary` |
| سفارش‌های روز | `GetDailyOrders` | date | `List<DailyUserOrder>` |
| رزرو یک کاربر-روز | `GetUserReservationAsync` | userId, date | آخرین رکورد روز |

اعتبارسنجی مهلت و نظر در همین متدها است (سند قواعد).

---

## ۳. یکپارچگی خارجی

| مورد | شواهد | وضعیت |
|---|---|---|
| SQL Server | `UseSqlServer(DefaultConnection)` | Verified |
| فایل گواهی Kestrel | `C:\myca\mycert.pfx` رمز در کد | Verified وابستگی میزبان |
| Serilog فایل | `Logs/log-.txt` روزانه | Verified |
| SignalR محصولی | `AddSignalR` بدون `MapHub` | Partially Implemented؛ هاب نیست |
| `HttpClient` BaseAddress localhost:5001 | ثبت DI | مصرف صفحه یافت نشد — Unused |
| ایمیل / SMS | جستجو | وجود ندارد |
| آپلود فایل پروفایل | فیلد `ProfileImagePath` | UI آپلود نیست |
| دانلود | لینک استاتیک گواهی و PDF | Verified |
| Background job / HostedService | جستجو | وجود ندارد |
| JWT / Azure | پکیج csproj | به مسیر اجرا وصل نیست |

MIME اضافه: `.pem` → `application/x-pem-file` در `Program.cs`. فایل pem در `wwwroot` دیده نشد.

---

## ۴. نوتیفیکیشن

`_Host.cshtml` اسکریپت‌های `js/signalr.min.js` و `js/notifications.js` را می‌گذارد. دومی در مخزن نیست؛ لاگ اجرا 404 داده است.

`MainLayout.LoadUnreadCountAsync` فقط `StateHasChanged` است و `UnreadCount` را از سرویس نمی‌خواند.

**وضعیت:** مکانیسم اعلان کامل نیست.

---

## ۵. امنیت انتقال

Kestrel فقط HTTPS روی `ListenAnyIP(5001)` با پکس فایل. `UseHttpsRedirection` هم هست. پورت‌های `launchSettings` (7275/5275) با پیام log override می‌شوند.
