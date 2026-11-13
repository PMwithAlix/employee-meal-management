import { authRequest } from '../auth/client'
import { AuthRequestError } from '../auth/errors'
import {
  parseGroup,
  parseGroupDetail,
  parseGroupHistory,
  parseGroupMember,
  type DirectoryGroup,
  type GroupDetail,
  type GroupMember,
  type GroupMembershipHistory,
} from './map'

export type { DirectoryGroup, GroupDetail, GroupMember, GroupMembershipHistory }

const session = { treatUnauthorizedAsSessionEnd: true as const }

const incompleteList = () => new AuthRequestError('http', 'بارگذاری فهرست گروه‌ها کامل نشد.')
const incompleteMembers = () => new AuthRequestError('http', 'بارگذاری اعضای گروه کامل نشد.')
const incompleteHistory = () => new AuthRequestError('http', 'بارگذاری تاریخچه عضویت کامل نشد.')
const invalidGroup = () => new AuthRequestError('http', 'پاسخ گروه نامعتبر است.')

function requireGroup(value: unknown): DirectoryGroup {
  const parsed = parseGroup(value)
  if (!parsed) throw invalidGroup()
  return parsed
}

function requireDetail(value: unknown): GroupDetail {
  const parsed = parseGroupDetail(value)
  if (!parsed) throw invalidGroup()
  return parsed
}

export const groupApi = {
  list(signal?: AbortSignal) {
    return authRequest<unknown>('/groups', { ...session, signal }).then((body) => {
      if (!Array.isArray(body)) throw incompleteList()
      const items: DirectoryGroup[] = []
      for (const item of body) {
        const parsed = parseGroup(item)
        if (!parsed) throw incompleteList()
        items.push(parsed)
      }
      return items
    })
  },

  get(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/groups/${id}`, { ...session, signal }).then(requireDetail)
  },

  create(name: string, signal?: AbortSignal) {
    return authRequest<unknown>('/groups', { ...session, method: 'POST', body: { name }, signal }).then(requireGroup)
  },

  update(id: string, name: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/groups/${id}`, { ...session, method: 'PATCH', body: { name }, signal }).then(requireGroup)
  },

  deactivate(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/groups/${id}/deactivate`, { ...session, method: 'POST', signal }).then(requireGroup)
  },

  members(id: string, signal?: AbortSignal) {
    return this.listMembers(id, signal).then((rows) => rows.map((row) => row.userId))
  },

  listMembers(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/groups/${id}/members`, { ...session, signal }).then((body) => {
      if (!Array.isArray(body)) throw incompleteMembers()
      const items: GroupMember[] = []
      for (const item of body) {
        const parsed = parseGroupMember(item)
        if (!parsed) throw incompleteMembers()
        items.push(parsed)
      }
      return items
    })
  },

  addMember(id: string, userId: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/groups/${id}/members`, {
      ...session,
      method: 'POST',
      body: { userId },
      signal,
    })
  },

  removeMember(id: string, userId: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/groups/${id}/members/${userId}`, { ...session, method: 'DELETE', signal })
  },

  history(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/groups/${id}/memberships/history`, { ...session, signal }).then((body) => {
      if (!Array.isArray(body)) throw incompleteHistory()
      const items: GroupMembershipHistory[] = []
      for (const item of body) {
        const parsed = parseGroupHistory(item)
        if (!parsed) throw incompleteHistory()
        items.push(parsed)
      }
      return items
    })
  },
}
