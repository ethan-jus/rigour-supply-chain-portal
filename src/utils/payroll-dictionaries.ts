import { businessDictionaryItemName, loadBusinessDictionaries, refreshBusinessDictionary } from './business-dictionary'

export const loadPayrollProductUnits = (refresh = false) => refresh
  ? refreshBusinessDictionary('PRODUCT_UNIT')
  : loadBusinessDictionaries([{ moduleCode: '', code: 'PRODUCT_UNIT' }])

/** Unit codes remain unchanged in requests and calculations; only their labels are displayed. */
export function payrollUnitName(code: string | null | undefined): string {
  if (!code?.trim()) return '未设置单位'
  return businessDictionaryItemName('', 'PRODUCT_UNIT', code) || '单位待维护'
}
