# نمایه ارجاع سورس

پیوند قابلیت‌ها، قواعد، سفرها و موجودیت‌ها به فایل‌های واقعی مخزن. مسیرها نسبت به ریشه `سامانه غذا/` هستند.

---

## پوسته و میزبان

| موضوع | مسیر | نماد |
|---|---|---|
| Solution | `ServiceApp.sln` | — |
| پروژه | `ServiceApp/ServiceApp.csproj` | net8.0 Web |
| ورود برنامه، کوکی، Kestrel، login/logout | `ServiceApp/Program.cs` | کل فایل |
| پوسته HTML | `ServiceApp/Pages/_Host.cshtml` | `@page "/"` |
| Router | `ServiceApp/App.razor` | `RouteView` |
| usingهای Razor | `ServiceApp/_Imports.razor` | — |
| هدر و نقش منو | `ServiceApp/Shared/MainLayout.razor` | `IsInRole` حدود ۲۰۰–۲۵۶ |
| اتصال DB | `ServiceApp/appsettings.json` | `DefaultConnection` |
| پروفایل اجرا | `ServiceApp/Properties/launchSettings.json` | override می‌شود |
| CSS سراسری | `ServiceApp/wwwroot/css/site.css` | فونت IRANSans |
| JS منوی پروفایل | `ServiceApp/wwwroot/js/site.js` | `toggleProfileMenu` |

---

## احراز هویت و کاربر

| موضوع | فایل | نماد / خطوط تقریبی |
|---|---|---|
| F-01 ورود UI | `ServiceApp/Pages/Login.razor` | فرم POST، نسخه 3.0.5 |
| F-01/F-02 API | `ServiceApp/Program.cs` | `MapPost("/login")`, `MapGet("/logout")` |
| BR-19 قفل، BR-20 رمز 1234، BR-22 IP | `ServiceApp/Services/UserService.cs` | `LoginAsync` ۳۴–۱۱۰ |
| CRUD کاربر | همان | `AddUserAsync` ۱۲۴+ |
| مدل کاربر | `ServiceApp/Models/User.cs` | `User`, `UserInputModel`, `LoginResult` |
| F-05 رمز | `ServiceApp/Pages/ChangePassword.razor` | `changePassword` |
| F-06 داشبورد | `ServiceApp/Pages/Dashboard.razor` | `[Authorize]` |
| F-22..27 مدیریت کاربران | `ServiceApp/Pages/UserManagement.razor` | `[Authorize(Roles = "مسئول دفتر")]` |

---

## منو

| موضوع | فایل | نماد |
|---|---|---|
| UI منو، BR-17، F-12/13/14 | `ServiceApp/Pages/MenuManagement.razor` | `isEditable`, `Save` |
| خواندن ماه + میانگین | `ServiceApp/Services/MenuService.cs` | `GetMenusForMonth`, `SaveOrUpdateAsync` |
| موجودیت | `ServiceApp/Models/DailyMenu.cs` | — |
| تقویم شمسی | `ServiceApp/Models/PersianCalendarHelper.cs` | کلاس بدون namespace |

---

## رزرو کارمند (سفر محافظت‌شده J-02)

| موضوع | فایل | نماد |
|---|---|---|
| کل سفر UI | `ServiceApp/Pages/UserReserve.razor` | `@page "/user-reservation"` |
| سلکت و مهلت UI | همان ۳۷۵–۴۲۳، ۴۶۳–۵۶۰ | `canEditLunch`, `canEditDinner` |
| Autosave | همان ۷۴۴–۷۶۲، ۸۸۹–۹۱۵ | `OnLunchChanged`, `Save` |
| امتیاز UI | همان ۵۶۳–۶۸۵، ۹۱۸–۹۶۹ | `SaveRating` |
| چاپ ماه | همان ۱۰۱۳–۱۰۳۸ | `PrintMonth` |
| ذخیره و مهلت سرور BR-01..03 | `ServiceApp/Services/FoodReservationService.cs` | `SaveOrUpdateAsync`, `IsAllowedToEditMeal` |
| امتیاز سرور BR-14 | همان ۲۹۵–۳۳۲ | `SaveRatingAsync`, `SanitizeComment` |
| موجودیت رزرو | `ServiceApp/Models/FoodReservations.cs` | `FoodReservation` |
| لاگ | `ServiceApp/Models/FoodReservationLog.cs` | — |
| enum وعده | انتهای `FoodReservationService.cs` | `MealType` |

---

## گزارش و عملیات پشتیبانی

| موضوع | فایل | نماد |
|---|---|---|
| صفحه گزارش F-15..21 | `ServiceApp/Pages/FoodReservations.razor` | `@page "/food-reservations"` |
| مهمان UserId 129 | همان ۶۲۶–۶۶۱ | `AddGuestMeal` |
| غذا برای کاربر | همان ۶۶۳–۷۲۶ | `AddUserMeal` |
| حذف نرم | همان ۹۱۳–۹۳۵ | `ConfirmDelete` → `SoftDeleteMealAsync` |
| خلاصه و سفارش روز BR-12 | `ServiceApp/Services/ReservationServiceImpl.cs` | `GetDailySummary`, `GetDailyOrders` |
| اینترفیس | `ServiceApp/Services/ReservationService.cs` | توجه: نام اینترفیس بدون پیشوند I |
| DTO | `ServiceApp/Models/DailyFoodSummary.cs`, `DailyUserOrder.cs` | — |
| چاپ در host | `ServiceApp/Pages/_Host.cshtml` | `printSection` |

---

## داده

| موضوع | فایل |
|---|---|
| DbContext | `ServiceApp/Services/AppDbContext.cs` — namespace `ServiceApp.Data` |
| DbSetها | `Users`, `DailyMenus`, `FoodReservations`, `FoodReservationLogs` |

---

## قابلیت‌های مرده / ناقص

| موضوع | فایل |
|---|---|
| F-30 رمزنگاری | `ServiceApp/Services/EncryptionService.cs` |
| F-31 Print stub | `ServiceApp/Models/Print.cs` |
| SignalR client library | `ServiceApp/wwwroot/js/signalr.min.js` |
| notifications.js | ارجاع در `_Host.cshtml` — فایل نیست |
| گواهی کلاینت | `ServiceApp/wwwroot/install/ca.cert.crt` |
| آموزش گواهی | `ServiceApp/wwwroot/install/How_to_Install_Root_CA_Certificate.pdf` |

---

## نگاشت سریع Feature → سورس

| ID | سورس اصلی |
|---|---|
| F-01 | `Login.razor` + `Program.cs` + `UserService.LoginAsync` |
| F-07 | `UserReserve.razor` + `FoodReservationService` + `MenuService` |
| F-09 | `UserReserve.SaveRating` + `SaveRatingAsync` |
| F-12 | `MenuManagement.razor` + `MenuService` |
| F-15 | `FoodReservations.razor` + `ReservationServiceImpl` |
| F-18 | `AddGuestMeal` + `UserId=129` |
| F-20 | `SoftDeleteMealAsync` |
| F-23 | `UserManagement.AddUser` + `AddUserAsync` |

## نگاشت Rule → سورس

| ID | سورس |
|---|---|
| BR-01, BR-02, BR-03 | `FoodReservationService.IsAllowedToEditMeal` / `SaveOrUpdateAsync` |
| BR-04, BR-05, BR-06 | `UserReserve.razor` |
| BR-07, BR-08 | `SaveOrUpdateAsync` خطوط ۵۵–۸۶ |
| BR-12 | `ReservationServiceImpl` + بخش lunch در `FoodReservations.razor` |
| BR-14 | `SaveRatingAsync` + سلول‌های امتیاز `UserReserve.razor` |
| BR-17, BR-18 | `MenuManagement.razor` + `MenuService.SaveOrUpdateAsync` |
| BR-19, BR-20 | `UserService.LoginAsync` |

## نگاشت Journey → سورس

| ID | سورس |
|---|---|
| J-01 | `Login.razor`, `Program.cs` |
| J-02 | `UserReserve.razor`, `FoodReservationService.cs`, `MenuService.cs` |
| J-03 | `Dashboard.razor` |
| J-04 | `ChangePassword.razor` |
| J-05 | `MenuManagement.razor` |
| J-06 | `FoodReservations.razor` |
| J-07 | `UserManagement.razor` |
