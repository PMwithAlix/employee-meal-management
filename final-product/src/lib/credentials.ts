const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const ALL = `${UPPER}${LOWER}${DIGITS}-`

const sessionSecrets = new Map<string, string>()

export const DEMO_PASSWORD = 'Kavosh-1405'
export const ADMIN_ACCOUNT_ID = 'admin'

export function normalizeUsername(value: string) {
  return value.trim().replace(/[A-Z]/g, (letter) => letter.toLowerCase())
}

export function passwordIssue(value: string) {
  if (value.length < 8) return 'رمز عبور باید حداقل ۸ نویسه باشد.'
  if (!/[A-Za-z]/.test(value)) return 'رمز عبور باید حداقل یک حرف انگلیسی داشته باشد.'
  if (!/[0-9]/.test(value)) return 'رمز عبور باید حداقل یک رقم داشته باشد.'
  return ''
}

function pick(source: string, n: number) {
  return source[n % source.length]
}

export function generatePassword() {
  const bytes = new Uint32Array(12)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (value, index) => {
    if (index === 0) return pick(UPPER, value)
    if (index === 1) return pick(LOWER, value)
    if (index === 2) return pick(DIGITS, value)
    return pick(ALL, value)
  })
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = new Uint32Array(1)
    crypto.getRandomValues(swap)
    const other = swap[0] % (index + 1)
    const current = chars[index]
    chars[index] = chars[other]
    chars[other] = current
  }
  return chars.join('')
}

export function setSessionSecret(accountId: string, password: string) {
  sessionSecrets.set(accountId, password)
}

export function verifySessionSecret(accountId: string, password: string) {
  return (sessionSecrets.get(accountId) ?? DEMO_PASSWORD) === password
}

export function formatCredentialPair(username: string, password: string) {
  return `نام کاربری: ${username}\nرمز عبور: ${password}`
}

export async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
}
