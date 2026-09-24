export const MEMBER_PASSWORD_HINT = '8–12 位，包含大小写字母、数字和英文符号，不能包含空格'

export function memberPasswordError(value: string | null | undefined): string {
  if (!value || value.length < 8 || value.length > 12) return '密码长度需为 8 至 12 位'
  if (!/^[!-~]+$/.test(value) || !/[A-Z]/.test(value) || !/[a-z]/.test(value)
    || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    return '密码须包含大写字母、小写字母、数字和英文符号，不能包含空格'
  }
  const letters = value.replace(/[^A-Za-z]/g, '').toLowerCase()
  if (['password', 'admin', 'qwerty', 'welcome', 'letmein'].includes(letters)) {
    return '不能使用常见弱密码，请更换字母和数字组合'
  }
  return ''
}
