import { describe, expect, it } from 'vitest'
import { defaultMenuAnnouncementCopy } from './menu-announcement'

describe('defaultMenuAnnouncementCopy', () => {
  it('builds the Aban title from the selected month index', () => {
    expect(defaultMenuAnnouncementCopy(8)).toEqual({
      title: 'منوی آبان آماده است 🍽️',
      body: 'برای مشاهده منو و ثبت وعده‌های غذایی وارد سامانه شوید.',
    })
  })

  it('does not hardcode a single month for Farvardin', () => {
    expect(defaultMenuAnnouncementCopy(1).title).toBe('منوی فروردین آماده است 🍽️')
  })
})
