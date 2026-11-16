export function placeTimePopup(
  anchor: { top: number; bottom: number; left: number; width: number },
  popup: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 4,
  pad = 8,
) {
  const width = Math.min(popup.width, Math.max(160, viewport.width - pad * 2))
  let left = anchor.left + anchor.width - width
  if (left + width > viewport.width - pad) left = viewport.width - pad - width
  if (left < pad) left = pad

  const below = anchor.bottom + gap
  const above = anchor.top - gap - popup.height
  const fitsBelow = below + popup.height <= viewport.height - pad
  const fitsAbove = above >= pad
  const top = fitsBelow
    ? below
    : fitsAbove
      ? above
      : Math.max(pad, Math.min(below, viewport.height - pad - popup.height))

  return { top, left, width }
}
