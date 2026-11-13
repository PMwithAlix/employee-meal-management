import { cn } from '../lib/text'
import wordmarkBlue from '../assets/brand/wordmark-blue.png'
import icon from '../assets/brand/icon.png'

export const BRAND_NAME = 'خوان'
export const BRAND_TAGLINE = 'سامانه هوشمند مدیریت غذای سازمانی'

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <img
      src={wordmarkBlue}
      alt={BRAND_NAME}
      draggable={false}
      className={cn('block w-auto max-w-full object-contain dark:brightness-0 dark:invert', className)}
    />
  )
}

export function BrandIcon({ className }: { className?: string }) {
  return (
    <img
      src={icon}
      alt={BRAND_NAME}
      draggable={false}
      className={cn('block object-contain', className)}
    />
  )
}
