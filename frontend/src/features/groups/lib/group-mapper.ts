export interface DirectoryGroup {
  id: string
  name: string
  isActive: boolean
}

export interface GroupDetail extends DirectoryGroup {
  memberCount: number | null
}

export interface GroupMember {
  membershipId: string
  groupId: string
  userId: string
  username: string
  role: string
  isActive: boolean
  startedAt: string
}

export interface GroupMembershipHistory {
  membershipId: string
  groupId: string
  userId: string
  username: string
  role: string
  startedAt: string
  endedAt: string | null
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function parseGroup(value: unknown): DirectoryGroup | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.name !== 'string') return null
  if (typeof body.isActive !== 'boolean') return null
  return { id: body.id, name: body.name, isActive: body.isActive }
}

export function parseGroupDetail(value: unknown): GroupDetail | null {
  const group = parseGroup(value)
  if (!group) return null
  const count = asRecord(asRecord(value)?._count)
  return {
    ...group,
    memberCount: typeof count?.memberships === 'number' && Number.isInteger(count.memberships) ? count.memberships : null,
  }
}

export function parseGroupMember(value: unknown): GroupMember | null {
  const body = asRecord(value)
  const user = asRecord(body?.user)
  if (!body || typeof body.id !== 'string' || typeof body.groupId !== 'string') return null
  const userId = typeof body.userId === 'string' ? body.userId : typeof user?.id === 'string' ? user.id : null
  if (!userId || typeof body.startedAt !== 'string' || !user) return null
  if (typeof user.username !== 'string' || typeof user.role !== 'string' || typeof user.isActive !== 'boolean') return null
  return {
    membershipId: body.id,
    groupId: body.groupId,
    userId,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    startedAt: body.startedAt,
  }
}

export function parseGroupHistory(value: unknown): GroupMembershipHistory | null {
  const body = asRecord(value)
  const user = asRecord(body?.user)
  if (!body || typeof body.id !== 'string' || typeof body.groupId !== 'string') return null
  const userId = typeof body.userId === 'string' ? body.userId : typeof user?.id === 'string' ? user.id : null
  if (!userId || typeof body.startedAt !== 'string' || !user || typeof user.username !== 'string' || typeof user.role !== 'string') return null
  return {
    membershipId: body.id,
    groupId: body.groupId,
    userId,
    username: user.username,
    role: user.role,
    startedAt: body.startedAt,
    endedAt: typeof body.endedAt === 'string' ? body.endedAt : null,
  }
}

export function formatGroupInstant(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(date)
}
