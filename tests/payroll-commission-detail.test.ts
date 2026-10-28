import { describe, expect, it } from 'vitest'
import type { PayrollDetail } from '@/api/core/payroll'
import { commissionCategories, commissionCollections } from '@/utils/payroll-commission-detail'
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

describe('商品回款与台球周边分组', () => {
  it('按数量计提也显示回款，同一订单商品的不同角色不重复累计回款', () => {
    const sales = line()
    sales.trace = { ...sales.trace!, method: 'QUANTITY', baseAmount: 2, collectionAmount: 200 }
    const manager = { ...sales, recipientRoleCode: 'CITY_MANAGER' }
    const other = line({
      sourceLineId: 'L2',
      trace: { ...sales.trace!, originalLineId: 'L2', collectionAmount: 100 },
    })
    const [category] = commissionCategories([sales, manager, other])
    expect(category!.collectionAmount).toBe(300)
    expect(category!.products[0]!.collectionAmount).toBe(300)
    expect(commissionCollections([sales, manager])).toBe(200)
    expect(
      commissionCollections([line({ trace: { ...sales.trace!, collectionAmount: null } })]),
    ).toBeNull()
  })
  it('历史比例基数可以追溯回款，历史数量基数不能当金额，冲突快照不取一个冒充合计', () => {
    expect(commissionCollections([line()])).toBe(2.5)
    expect(
      commissionCollections([line(), line({ trace: { ...line().trace!, baseAmount: 3 } })]),
    ).toBeNull()
  })
  it('按ERP分类路径合并台球周边，台呢保留独立分组，不按商品名称猜测', () => {
    const product = (categoryId: number, categoryPath: string) =>
      line({
        trace: {
          ...line().trace!,
          product: { ...line().trace!.product!, categoryId, categoryPath },
        },
      })
    const rows = commissionCategories([
      product(3, '台球周边 / 皮头'),
      product(4, '台球周边 / 巧克粉'),
      product(5, '台球周边 / 台呢'),
      product(6, '台球周边 / 台呢 / 其他'),
      line({ productName: '台呢' }),
    ])
    expect(rows.map((row) => row.name)).toEqual([
      '台球周边（不含台呢）',
      '台球周边 / 台呢',
      '快消品 / 方便面',
    ])
    expect(rows[0]!.lineCount).toBe(2)
    expect(rows[1]!.lineCount).toBe(2)
  })
})
