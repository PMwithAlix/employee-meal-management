import { authRequest } from '../../auth/api/auth-api'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { parseDailyReport } from '../lib/report-mapper'
import { REPORT_ENDPOINTS } from '../model/report-types'

const session = { treatUnauthorizedAsSessionEnd: true as const }

export const reportApi = {
  daily(mealDate: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ mealDate })
    return authRequest<unknown>(`${REPORT_ENDPOINTS.daily}?${params.toString()}`, { ...session, signal }).then((body) => {
      const parsed = parseDailyReport(body)
      if (!parsed) throw new AuthRequestError('http', 'پاسخ گزارش نامعتبر است.')
      return parsed
    })
  },
}
