export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function passwordIssue(value: string) {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return 'رمز عبور باید حداقل ۸ نویسه باشد.';
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return 'رمز عبور بیش از حد طولانی است.';
  }
  if (!/[A-Za-z]/.test(value)) {
    return 'رمز عبور باید حداقل یک حرف انگلیسی داشته باشد.';
  }
  if (!/[0-9]/.test(value)) {
    return 'رمز عبور باید حداقل یک رقم داشته باشد.';
  }
  return '';
}
