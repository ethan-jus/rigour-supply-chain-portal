export const payrollCategories = [
  { value: 'SALES', label: '销售' },
  { value: 'HEADQUARTERS', label: '总部' },
] as const
export const payrollCategoryLabel = (value?: string | null) =>
  payrollCategories.find((item) => item.value === value)?.label ?? '待完善'
export const regularizationLabel = (value?: boolean | null) =>
  value == null ? '待完善' : value ? '已转正' : '未转正'
export const isSalesSalary = (value?: string | null) =>
  !value?.trim() || /^\d{1,14}(\.\d{1,2})?$/.test(value.trim())

// 销售薪酬类别同时包含业务员，不能据此开放城市管辖配置。
export const isCityManagerPosition = (positionName?: string | null) =>
  ['城市总', '见习城市总'].includes(positionName?.trim() || '')
