import type { ProcurementOrderSummary, ProcurementProduct } from '@/api/core/erp-documents'
export function editableProcurement(row: ProcurementOrderSummary) {
  return (
    !row.sourceSystemCode &&
    row.confirmationStatusCode === 'UNCONFIRMED' &&
    row.statusCode === 'DRAFT'
  )
}
export function procurementPayable(
  row: Pick<ProcurementOrderSummary, 'totalAmount' | 'freightAmount' | 'freightBearerCode'>,
) {
  return (
    Number(row.totalAmount || 0) +
    (row.freightBearerCode === 'BUYER' ? Number(row.freightAmount || 0) : 0)
  )
}
export interface ProcurementEditableLine extends ProcurementProduct {
  unitCode: string
  quantity: number | undefined
  unitPrice: number | undefined
  remark: string
}
export function roundProcurementInput(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return value ?? undefined
  const shift = (n: number, places: number) => {
    const [coefficient, exponent = '0'] = String(n).split('e')
    return Number(`${coefficient}e${Number(exponent) + places}`)
  }
  return shift(Math.round(shift(value, 2)), -2)
}
export function appendProcurementProducts(
  current: ProcurementEditableLine[],
  products: ProcurementProduct[],
) {
  const codes = new Set(current.map((row) => row.variantCode))
  const result = [...current]
  for (const product of products) {
    if (codes.has(product.variantCode)) continue
    codes.add(product.variantCode)
    result.push({
      ...product,
      unitCode: product.defaultUnitCode,
      quantity: undefined,
      unitPrice: roundProcurementInput(product.purchasePrice),
      remark: '',
    })
  }
  return result
}
