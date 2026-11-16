export type RectBox = {
  top: number
  bottom: number
  left: number
  right: number
  width: number
}

export type ViewBox = {
  top: number
  bottom: number
  left: number
  right: number
}

export type MealPickerBox = {
  top: number
  left: number
  width: number
  maxHeight: number
  placeAbove: boolean
}

const GAP = 4
const GUTTER = 8
const MIN_HEIGHT = 80

export function placeMealPicker(
  trigger: RectBox,
  contentHeight: number,
  view: ViewBox,
  rtl = true,
  gap = GAP,
  gutter = GUTTER,
): MealPickerBox {
  const viewWidth = Math.max(0, view.right - view.left)
  const width = Math.min(Math.max(0, trigger.width), Math.max(0, viewWidth - gutter * 2))
  let left = rtl ? trigger.right - width : trigger.left
  if (left + width > view.right - gutter) left = view.right - gutter - width
  if (left < view.left + gutter) left = view.left + gutter

  const spaceBelow = view.bottom - (trigger.bottom + gap)
  const spaceAbove = trigger.top - gap - view.top
  const natural = Math.max(0, contentHeight)
  const placeAbove =
    natural > 0 && natural <= spaceBelow
      ? false
      : natural > 0 && natural <= spaceAbove
        ? true
        : spaceAbove > spaceBelow

  const available = Math.max(0, placeAbove ? spaceAbove : spaceBelow)
  let height = natural > 0
    ? Math.min(natural, available)
    : Math.min(MIN_HEIGHT, available)
  let top = placeAbove ? trigger.top - gap - height : trigger.bottom + gap
  if (placeAbove) {
    if (top < view.top + gutter) {
      top = view.top + gutter
      height = Math.max(0, trigger.top - gap - top)
    }
  } else if (top + height > view.bottom - gutter) {
    height = Math.max(0, view.bottom - gutter - top)
  }

  return { top, left, width, maxHeight: height, placeAbove }
}

export function pickerViewBounds(
  viewport: { offsetTop: number; offsetLeft: number; width: number; height: number },
  chrome: { headerBottom: number | null; navTop: number | null },
) {
  const top = viewport.offsetTop
  const left = viewport.offsetLeft
  const right = left + viewport.width
  const bottom = top + viewport.height
  return {
    top: chrome.headerBottom != null ? Math.max(top, chrome.headerBottom) : top,
    left,
    right,
    bottom: chrome.navTop != null ? Math.min(bottom, chrome.navTop) : bottom,
  }
}

export function samePickerBox(a: MealPickerBox, b: MealPickerBox) {
  return a.top === b.top && a.left === b.left && a.width === b.width && a.maxHeight === b.maxHeight && a.placeAbove === b.placeAbove
}
