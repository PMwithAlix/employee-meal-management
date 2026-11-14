import { AuthRequestError } from '../../auth/lib/auth-errors'
import { jalaliMonthLength } from '../../../shared/lib/jalali'
import { formatGregorianDate } from '../../menus/lib/menu-mapper'
import { guestApi } from '../api/guests-api'

const incomplete = () => new AuthRequestError('http', 'بارگذاری شمارش سفارش‌های مهمان کامل نشد.')

export async function countActiveGuestOrdersInMonth(jy: number, jm: number, signal?: AbortSignal) {
  const length = jalaliMonthLength(jy, jm)
  if (length <= 0) return 0
  const days = Array.from({ length }, (_, index) => index + 1)
  const pages = await Promise.all(
    days.map((jd) =>
      guestApi.list(
        {
          mealDate: formatGregorianDate(jy, jm, jd),
          status: 'ACTIVE',
          page: 1,
          pageSize: 1,
        },
        signal,
      ),
    ),
  )
  let count = 0
  for (const listed of pages) {
    if (!Number.isInteger(listed.total) || listed.total < 0) throw incomplete()
    if (listed.page !== 1 || listed.pageSize !== 1) throw incomplete()
    if (listed.items.length > 1) throw incomplete()
    count += listed.total
  }
  return count
}
