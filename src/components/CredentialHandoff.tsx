import { useState } from 'react'
import { Button } from './ui'
import { copyText, formatCredentialPair } from '../lib/credentials'

export function CredentialHandoff({
  username,
  password,
  title,
  onDone,
}: {
  username: string
  password: string
  title: string
  onDone: () => void
}) {
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')

  async function copy(kind: string, value: string) {
    try {
      await copyText(value)
      setError('')
      setCopied(kind)
    } catch {
      setError('کپی انجام نشد. مقدار را دستی بردارید.')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted">این مقادیر فقط برای تحویل در همین نشست نمایش داده می‌شوند و در حساب کارمند یا حافظه پایدار مرورگر ذخیره نمی‌شوند. ورود آزمایشی همچنان با هر نام کاربری و رمز غیرخالی انجام می‌شود.</p>
      <dl className="space-y-2 rounded-md border border-line bg-surface2 p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">نام کاربری</dt>
          <dd className="font-medium" dir="ltr">{username}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">رمز عبور اولیه</dt>
          <dd className="break-all font-medium" dir="ltr">{password}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void copy('user', username)}>{copied === 'user' ? 'کپی شد' : 'کپی نام کاربری'}</Button>
        <Button variant="secondary" onClick={() => void copy('pass', password)}>{copied === 'pass' ? 'کپی شد' : 'کپی رمز عبور'}</Button>
        <Button variant="secondary" onClick={() => void copy('both', formatCredentialPair(username, password))}>{copied === 'both' ? 'کپی شد' : 'کپی هر دو'}</Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex justify-end">
        <Button onClick={onDone}>بستن</Button>
      </div>
    </div>
  )
}
