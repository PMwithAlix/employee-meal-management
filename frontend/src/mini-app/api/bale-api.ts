import { authRequest } from '../../features/auth/api/auth-api'

export type BaleRuntimeStatus = {
  enabled: boolean
  botConfigured: boolean
  miniAppUrl: string
  webhookConfigured: boolean
}

export const baleApi = {
  status(signal?: AbortSignal) {
    return authRequest<BaleRuntimeStatus>('/bale/status', { signal })
  },
  login(input: { initData: string; username: string; password: string; chatId?: string }) {
    return authRequest<unknown>('/bale/auth/login', {
      method: 'POST',
      body: input,
    })
  },
}
