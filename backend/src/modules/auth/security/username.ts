export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

export function usernameIssue(value: string) {
  const username = normalizeUsername(value);
  if (!username) {
    return 'نام کاربری را وارد کنید.';
  }
  if (!USERNAME_PATTERN.test(username)) {
    return 'نام کاربری فقط می‌تواند حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.';
  }
  return '';
}
