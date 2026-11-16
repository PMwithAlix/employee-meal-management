import { authDownload, authRequest } from '../../auth/api/auth-api'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { parseDailyReport, parseMonthlyReport, saveBlob } from '../lib/report-mapper'
import { REPORT_ENDPOINTS, type ReportMealFilter } from '../model/report-types'

const session = { treatUnauthorizedAsSessionEnd: true as const }

export const reportApi = {
  daily(mealDate: string, meal: ReportMealFilter = 'ALL', signal?: AbortSignal) {
    const params = new URLSearchParams({ mealDate, meal })
    return authRequest<unknown>(`${REPORT_ENDPOINTS.daily}?${params.toString()}`, { ...session, signal }).then((body) => {
      const parsed = parseDailyReport(body)
      if (!parsed) throw new AuthRequestError('http', 'پاسخ گزارش نامعتبر است.')
      return parsed
    })
  },

  monthly(year: number, month: number, meal: ReportMealFilter = 'ALL', signal?: AbortSignal) {
    const params = new URLSearchParams({ year: String(year), month: String(month), meal })
    return authRequest<unknown>(`${REPORT_ENDPOINTS.monthly}?${params.toString()}`, { ...session, signal }).then((body) => {
      const parsed = parseMonthlyReport(body)
      if (!parsed) throw new AuthRequestError('http', 'پاسخ گزارش ماهانه نامعتبر است.')
      return parsed
    })
  },

  async downloadMonthlyExcel(year: number, month: number, meal: ReportMealFilter = 'ALL', signal?: AbortSignal) {
    const params = new URLSearchParams({ year: String(year), month: String(month), meal })
    const result = await authDownload(`${REPORT_ENDPOINTS.monthlyExcel}?${params.toString()}`, {
      ...session,
      signal,
      accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveBlob(result.blob, result.filename || `monthly-report-${year}-${month}-${meal}.xlsx`)
  },
}
