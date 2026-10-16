export interface PayrollSchemeCommissionRule {
  code: string
  rowCode?: string | null
  name: string
  recipientRole: string
  categoryIds: number[]
  excludedCategoryIds: number[]
  variantIds: string[]
  excludedVariantIds: string[]
  method: string
  value: number | null
  unitCode: string
  excluded: boolean
}
