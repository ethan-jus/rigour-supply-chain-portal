import { describe, expect, it } from 'vitest'
import type { PayrollDetail } from '@/api/core/payroll'
import { commissionCategories } from '@/utils/payroll-commission-detail'
const line = (overrides: Partial<PayrollDetail> = {}): PayrollDetail => ({
  sourceLineId: 'L1',
  orderNo: 'O1',
  productName: '同名商品',
  recipientRoleCode: 'SALES',
  unitCode: 'BOX',
  quantity: 1,
  ruleId: 'R1',
  ruleName: '规则',
  ruleRevision: 1,
  accrued: 0.1,
  released: 0.1,
  message: '',
  trace: {
    orderId: 'O1',
    cityCode: 'C1',
    variantId: 1,
    baseAmount: 2.5,
    rate: 4,
    method: 'PERCENT',
    fullyPaidDate: '2026-09-30',
    refundedAmount: 0,
    ruleCode: 'NOODLES',
    schemeVersionId: 'V1',
    originalLineId: 'L1',
    product: {
      productId: 1,
      variantId: 1,
      productCode: 'P1',
      variantCode: 'SKU1',
      specification: '规格',
      categoryId: 2,
      categoryName: '方便面',
      categoryPath: '快消品 / 方便面',
    },
  },
  ...overrides,
})
describe('提成分类与订单证据', () => {
  it('金额按分汇总，角色分别展示，同订单在分类汇总中只计一次', () => {
    const rows = commissionCategories([
      line(),
      line({ sourceLineId: 'L2', accrued: 0.2, released: 0.2 }),
      line({ recipientRoleCode: 'CITY_MANAGER', accrued: 0.1, released: 0.1 }),
    ])
    expect(rows[0]).toMatchObject({ amount: 0.4, orderCount: 1, lineCount: 3, pendingCount: 0 })
    expect(rows[0].products).toHaveLength(2)
    expect(rows[0].products[0].amount).toBe(0.3)
  })
  it('同名不同 SKU、单位、版本不能合并；待核定明细保留且不假作零', () => {
    const source = line()
    const rows = commissionCategories([
      source,
      line({
        trace: {
          ...source.trace!,
          variantId: 2,
          product: { ...source.trace!.product!, variantId: 2 },
        },
      }),
      line({ unitCode: 'SET' }),
      line({ ruleId: 'R2' }),
      line({ ruleId: null, ruleName: null, accrued: null, released: null }),
    ])
    expect(rows[0].products).toHaveLength(5)
    expect(rows[0]).toMatchObject({ amount: null, knownAmount: 0.4, pendingCount: 1 })
    expect(rows[0].products[4].lines).toHaveLength(1)
  })
  it('旧快照缺少 ERP 分类不按商品名字猜分类', () => {
    expect(commissionCategories([line({ trace: null })])[0].name).toBe('历史快照未记录分类')
  })
})
