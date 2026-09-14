import { businessDictionaryLabel, loadBusinessDictionaries } from '@/utils/business-dictionary'

export const loadReportDictionaries = () =>
  loadBusinessDictionaries([{ moduleCode: 'COMMON', code: 'PRODUCT_UNIT' }])

export function reportUnitName(code: string | null | undefined): string {
  if (!code) return '未标明单位'
  const label = businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', code, '单位')
  // Business Settings V26 defines GRAIN; deployed dictionaries may not yet include that entry.
  return label === code && code.toUpperCase() === 'GRAIN' ? '颗' : label
}

export function reportSourceName(code: string | null | undefined, label?: string): string {
  if (label && label !== code) return label
  return (
    (
      { FEISHU: '飞书', DINGHUOBAO: '订货宝', DHB: '订货宝', MANUAL: '手工订单' } as Record<
        string,
        string
      >
    )[code || ''] ||
    label ||
    '未提供来源名称'
  )
}

/** Expand decimal strings without losing source precision. */
export function reportDecimalText(value: unknown): string {
  if (value == null) return ''
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    (typeof value === 'number' && !Number.isFinite(value))
  )
    throw new Error('报表包含无效数值')
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(String(value))
  if (!match) throw new Error('报表包含无效数值')
  const [, sign, integer, fraction = '', exponent = '0'] = match
  const shift = Number(exponent)
  if (!Number.isSafeInteger(shift) || Math.abs(shift) > 10000)
    throw new Error('报表数值超出可导出范围')
  const digits = integer + fraction
  const point = integer.length + shift
  const expanded =
    point <= 0
      ? `0.${'0'.repeat(-point)}${digits}`
      : point >= digits.length
        ? digits + '0'.repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`
  return (sign === '-' ? '-' : '') + expanded
}

/** Round only at the presentation boundary, including negative half-cent values. */
export function reportMoneyText(value: unknown): string {
  const text = reportDecimalText(value)
  if (!text) return ''
  const [integer, fraction = ''] = text.replace(/^-/, '').split('.')
  const cents =
    BigInt(integer + fraction.padEnd(2, '0').slice(0, 2)) +
    (Number(fraction[2] || '0') >= 5 ? 1n : 0n)
  const digits = cents.toString().padStart(3, '0')
  return `${text.startsWith('-') && cents !== 0n ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`
}

export function reportQuantityText(value: unknown): string {
  const text = reportDecimalText(value)
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}
