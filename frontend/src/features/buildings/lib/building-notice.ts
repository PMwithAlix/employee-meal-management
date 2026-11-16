export function buildingStatusSuccessNotice(isActive: boolean) {
  return isActive ? 'ساختمان دوباره فعال شد.' : 'ساختمان غیرفعال شد.'
}

export function buildingTransferSuccessNotice(username: string) {
  return `حساب ${username} به این ساختمان منتقل شد.`
}

export function buildingDetachSuccessNotice(username: string, destinationName?: string) {
  if (destinationName) return `حساب ${username} به ساختمان «${destinationName}» منتقل شد.`
  return `حساب ${username} از این ساختمان جدا شد.`
}

export function noticeAfterBuildingSelection(
  currentId: string,
  nextId: string,
  notice: string,
) {
  return nextId === currentId ? notice : ''
}
