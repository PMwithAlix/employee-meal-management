import { describe, expect, it } from 'vitest'
import {
  buildingDetachSuccessNotice,
  buildingStatusSuccessNotice,
  buildingTransferSuccessNotice,
  noticeAfterBuildingSelection,
} from './building-notice'

describe('building notice ownership', () => {
  it('keeps a deactivate success notice on the same building and clears it after selecting another', () => {
    const deactivated = buildingStatusSuccessNotice(false)
    expect(deactivated).toBe('ساختمان غیرفعال شد.')
    expect(noticeAfterBuildingSelection('a', 'a', deactivated)).toBe(deactivated)
    expect(noticeAfterBuildingSelection('a', 'b', deactivated)).toBe('')
  })

  it('shows a success notice for a later operation on the newly selected building', () => {
    const afterSwitch = noticeAfterBuildingSelection('a', 'b', 'ساختمان غیرفعال شد.')
    expect(afterSwitch).toBe('')
    expect(buildingStatusSuccessNotice(true)).toBe('ساختمان دوباره فعال شد.')
    expect(buildingTransferSuccessNotice('pr2val.emp')).toBe(
      'حساب pr2val.emp به این ساختمان منتقل شد.',
    )
    expect(buildingDetachSuccessNotice('pr2val.emp', 'فرعی')).toBe(
      'حساب pr2val.emp به ساختمان «فرعی» منتقل شد.',
    )
  })
})
