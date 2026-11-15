import { describe, expect, it } from 'vitest'
import { auditActionLabel, describeAuditEvent, formatActivityTime } from './audit-copy'
import type { AuditLogItem } from '../api/audit-api'

function item(overrides: Partial<AuditLogItem> = {}): AuditLogItem {
  return {
    id: '1',
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: 'user-1',
    actorId: 'admin-1',
    actorUsername: 'khaan.admin',
    beforeData: null,
    afterData: { username: 'ali.rezaei', role: 'EMPLOYEE' },
    createdAt: '2026-11-15T10:05:00.000Z',
    ...overrides,
  }
}

describe('describeAuditEvent', () => {
  it('turns action codes into Persian labels without dumping JSON', () => {
    const view = describeAuditEvent(item())
    expect(view.action).toBe('ایجاد کاربر')
    expect(view.target).toBe('ali.rezaei')
    expect(view.detail).toContain('نام کاربری: ali.rezaei')
    expect(view.detail).toContain('نقش: کارمند')
    expect(view.after).not.toContain('{')
    expect(view.after).not.toContain('user-1')
  })

  it('summarizes field changes instead of raw before/after objects', () => {
    const view = describeAuditEvent(
      item({
        action: 'USER_UPDATED',
        beforeData: { role: 'EMPLOYEE', username: 'ali.rezaei' },
        afterData: { role: 'SUPPORT', username: 'ali.rezaei' },
      }),
    )
    expect(view.action).toBe('ویرایش کاربر')
    expect(view.detail).toContain('نقش از «کارمند» به «پشتیبانی»')
    expect(view.detail).not.toMatch(/SELECT |UPDATE |INSERT /i)
  })
})

describe('auditActionLabel', () => {
  it('keeps unknown actions readable without inventing a translation', () => {
    expect(auditActionLabel('MENU_CREATED')).toBe('ایجاد منوی ماهانه')
    expect(auditActionLabel('CUSTOM_THING')).toBe('CUSTOM_THING')
  })
})

describe('formatActivityTime', () => {
  it('formats timestamps as Jalali wall-clock text', () => {
    const text = formatActivityTime('2026-03-21T00:30:00.000Z')
    expect(text).toMatch(/۱۴۰۵/)
    expect(text).not.toMatch(/T00:30:00/)
  })
})
