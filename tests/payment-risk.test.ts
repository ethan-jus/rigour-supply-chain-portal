import { describe, expect, it } from 'vitest'
import type { PaymentRiskData, PaymentRiskOrder } from '@/api/core/payment-risk'
import {
  activeOrderMonths,
  matrixCellRisk,
  attributedProduct,
  categoryMatches,
  emptyRiskFilters,
  groupRiskOrders,
  orderAmount,
  riskGroups,
  selectRiskOrders,
} from '@/views/supply-chain/bi/payment-risk-model'

const order: PaymentRiskOrder = {
  orderId: '1',
  orderNo: 'DEMO-1',
  customerName: '演示客户',
  regionCode: 'CD',
  regionName: '成都',
  ownerStaffCode: 'A',
  ownerStaffName: '业务员A',
  orderDate: '2026-09-25',
  ageDays: 25,
  orderAmount: 10000,
  paidAmount: 6000,
  products: [
    {
      categoryId: '11',
      categoryName: '台呢子分类',
      productId: '1',
      productName: '台呢A',
      riskLevel: 'HIGH',
      productAmount: 2000,
    },
    {
      categoryId: '11',
      categoryName: '台呢子分类',
      productId: '2',
      productName: '台呢B',
      riskLevel: 'HIGH',
      productAmount: 3000,
    },
    {
      categoryId: '2',
      categoryName: '球杆',
      productId: '3',
      productName: '球杆A',
      riskLevel: 'LOW',
      productAmount: 5000,
    },
  ],
}
const data: PaymentRiskData = {
  generatedAt: '2026-10-20T00:00:00Z',
  dataUpdatedAt: null,
  categories: [
    { id: '1', parentId: null, name: '台呢' },
    { id: '11', parentId: '1', name: '台呢子分类' },
    { id: '2', parentId: null, name: '球杆' },
  ],
  orders: [order],
}
describe('未结清订单风险整单口径', () => {
  it('隐藏所有城市均无未结清金额的月份，保留任一城市有订单的月份', () => {
    const july = { ...order, orderId: '2', regionCode: 'SZ', orderDate: '2026-07-10' }
    const zero = { ...order, orderId: '3', orderDate: '2026-08-10', orderAmount: 0 }
    expect(activeOrderMonths([order, july, zero], '2026-06', '2026-10')).toEqual([
      '2026-07',
      '2026-09',
    ])
    expect(
      activeOrderMonths(
        selectRiskOrders(
          { ...data, orders: [order, july] },
          { ...emptyRiskFilters(), region: 'CD' },
        ),
        '2026-06',
        '2026-10',
      ),
    ).toEqual(['2026-09'])
    expect(activeOrderMonths([], '2026-06', '2026-10')).toEqual([])
  })
  it('部分回款不扣减，重复订单也不能放大总金额', () => {
    expect(orderAmount([order, order])).toBe(10000)
  })
  it('混合订单只归属最高风险，风险合计等于整单总额', () => {
    const risks = riskGroups([order])
    expect(risks.find((r) => r.key === 'LOW')?.amount).toBe(0)
    expect(risks.find((r) => r.key === 'HIGH')?.amount).toBe(10000)
    expect(risks.find((r) => r.key === 'HIGH')?.count).toBe(1)
    expect(risks.reduce((n, r) => n + r.amount, 0)).toBe(10000)
    expect(orderAmount([order])).toBe(10000)
  })
  it('多选父子分类取并集，不按选中产品数量重复金额', () => {
    const selected = selectRiskOrders(data, { ...emptyRiskFilters(), categories: ['1', '11', '2'] })
    expect(selected).toHaveLength(1)
    expect(orderAmount(selected)).toBe(10000)
    const groups = groupRiskOrders(selected, (o) =>
      o.products.map((p) => ({ key: p.categoryId!, name: p.categoryName! })),
    )
    expect(groups.map((g) => g.amount)).toEqual([10000])
  })
  it('先确定唯一归属，再筛选分类，不能降级或重新归属', () => {
    expect(selectRiskOrders(data, { ...emptyRiskFilters(), categories: ['2'] })).toHaveLength(0)
    expect(selectRiskOrders(data, { ...emptyRiskFilters(), risk: 'LOW' })).toHaveLength(0)
    expect(
      selectRiskOrders(data, { ...emptyRiskFilters(), categories: ['2'], risk: 'HIGH' }),
    ).toHaveLength(0)
    expect(
      selectRiskOrders(data, { ...emptyRiskFilters(), categories: ['1'], risk: 'HIGH' }),
    ).toHaveLength(1)
  })
  it('月份、城市、业务员与分类交叉筛选', () => {
    expect(selectRiskOrders(data, { ...emptyRiskFilters(), month: '2026-08' })).toHaveLength(0)
    expect(
      selectRiskOrders(data, {
        ...emptyRiskFilters(),
        region: 'CD',
        owner: 'A',
        month: '2026-09',
        categories: ['1'],
      }),
    ).toHaveLength(1)
  })
  it('风险优先于金额，并列风险按同产品多行合计金额归属', () => {
    expect(attributedProduct(order).productId).toBe('2')
    const repeated = { ...order, products: [...order.products, order.products[0]!] }
    expect(attributedProduct(repeated).productId).toBe('1')
    expect(attributedProduct(repeated).productAmount).toBe(4000)
    const tied = {
      ...order,
      products: [{ ...order.products[1]!, productAmount: 2000 }, order.products[0]!],
    }
    expect(attributedProduct(tied).productId).toBe('1')
    expect(attributedProduct({ ...tied, products: [...tied.products].reverse() }).productId).toBe(
      '1',
    )
  })
  it('所有分类、产品、风险的金额和订单数都与去重总计一致', () => {
    const another = { ...order, orderId: '2', products: [order.products[2]!] }
    const selected = selectRiskOrders(
      { ...data, orders: [order, order, another] },
      emptyRiskFilters(),
    )
    expect(selected).toHaveLength(2)
    const partitions = [
      riskGroups(selected),
      ...(['category', 'product'] as const).map((dimension) =>
        groupRiskOrders(selected, (o) => [
          {
            key: dimension === 'category' ? o.products[0]!.categoryId! : o.products[0]!.productId!,
            name: '',
          },
        ]),
      ),
    ]
    for (const groups of partitions) {
      expect(groups.reduce((sum, g) => sum + g.amount, 0)).toBe(orderAmount(selected))
      expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(selected.length)
    }
  })
  it('城市月份格以最高风险着色而非金额大小，空格与零金额为正常', () => {
    const severe = {
      ...order,
      orderId: 'small',
      orderAmount: 1,
      products: [{ ...order.products[0]!, riskLevel: 'SEVERE' as const }],
    }
    const low = { ...order, products: [order.products[2]!] }
    expect(matrixCellRisk([low, severe])).toBe('SEVERE')
    expect(matrixCellRisk([low])).toBe('LOW')
    expect(matrixCellRisk([])).toBe('NORMAL')
    expect(matrixCellRisk([{ ...severe, orderAmount: 0 }])).toBe('NORMAL')
    expect(matrixCellRisk([{ ...order, products: [] }])).toBe('UNKNOWN')
  })
  it('缺分类不默认为台呢或其他分类，父级环不会死循环', () => {
    expect(categoryMatches(null, ['1'], data.categories)).toBe(false)
    expect(categoryMatches(null, ['__UNKNOWN__'], data.categories)).toBe(true)
    expect(
      categoryMatches(
        'x',
        ['missing'],
        [
          { id: 'x', parentId: 'y', name: '' },
          { id: 'y', parentId: 'x', name: '' },
        ],
      ),
    ).toBe(false)
  })
})
