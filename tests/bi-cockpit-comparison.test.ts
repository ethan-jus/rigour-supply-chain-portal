import { describe, expect, it } from 'vitest'
import { comparisonLabel, growthFigure } from '@/views/supply-chain/bi/cockpit-comparison'
import type { BiComparison } from '@/api/core/bi-comparison'
const values = (salesAmount: number) => ({
  salesAmount,
  paidAmount: 0,
  unpaidAmount: salesAmount,
  orderCount: 1,
  customerCount: 1,
})
const source = (): BiComparison => ({
  from: '2026-09-01',
  to: '2026-09-10',
  previousFrom: '2026-08-22',
  previousTo: '2026-08-31',
  generatedAt: '',
  current: values(120),
  previous: values(100),
  cities: [{ regionCode: 'BJ', regionName: '北京', current: values(120), previous: values(100) }],
})
describe('真实前期比较', () => {
  it('按完整汇总计算增减，不把零分母显示为0%或无穷大', () => {
    const data = source()
    expect(comparisonLabel(data, '销售额')).toBe('较前期 +20.00%')
    expect(comparisonLabel(data, '回款额')).toBe('较前期持平')
    data.previous.salesAmount = 0
    expect(comparisonLabel(data, '销售额')).toContain('增加')
    data.previous.orderCount = 0
    expect(comparisonLabel(data, '销售额')).toBe('前期无订单')
    expect(comparisonLabel(data, '估算结余')).toBe('')
  })
  it('增长来源保留所有城市明细并说明累计回款，不称历史到账', () => {
    const data = source()
    data.cities = Array.from({ length: 12 }, (_, i) => ({
      regionCode: String(i),
      regionName: `城市${i}`,
      current: values(10),
      previous: values(i),
    }))
    const figure = growthFigure(data)
    expect(figure.rows).toHaveLength(14)
    expect(figure.note).toContain('回款均累计至当前快照')
    expect(figure.option.xAxis).toMatchObject({
      data: expect.arrayContaining(['前期销售', '其他城市', '本期销售']),
    })
  })
})
