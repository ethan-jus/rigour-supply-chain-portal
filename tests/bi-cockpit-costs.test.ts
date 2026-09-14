import { describe, expect, it, vi } from 'vitest'
import type { SupplyDashboardCityCostItem, SupplyDashboardRankingItem } from '@/api/core/bi'
import {
  aggregateCostLines,
  operatingCosts,
  sampleCostLines,
  sampleCostRules,
  sampleSkuCosts,
  type CostLine,
  type OperatingCostData,
} from '@/views/supply-chain/bi/cockpit-costs'

const city = (code: string, salesAmount = 100000): SupplyDashboardRankingItem => ({
  rankType: 'CITY',
  dimensionCode: code,
  dimensionName: code,
  regionCode: code,
  regionName: code,
  salesAmount,
  paidAmount: 0,
  unpaidAmount: salesAmount,
  orderCount: 1,
  customerCount: 1,
  rate: 0,
})
const actual = (
  regionCode: string,
  costAmount: number,
  recordCount = 1,
): SupplyDashboardCityCostItem => ({
  regionCode,
  regionName: regionCode,
  costAmount,
  recordCount,
  salesAmount: 100000,
  budgetAmount: 0,
  varianceAmount: costAmount,
  costRate: 0,
  latestCostTime: null,
})
const metric = (metricCode: string, value: number) => ({
  metricCode,
  value,
  metricName: metricCode,
  unit: 'CNY',
  previousValue: null,
  changeRate: null,
  description: null,
})
const data = (cities = ['武汉']): OperatingCostData => ({
  from: '2026-09-01T00:00:00+08:00',
  to: '2026-09-30T23:59:59+08:00',
  metrics: [metric('sales_amount', cities.length * 100000)],
  citySalesRanking: cities.map((code) => city(code)),
  cityCostRanking: [],
})
const sumCents = (lines: readonly { amount: number }[]) =>
  lines.reduce((total, row) => total + Math.round(row.amount * 100), 0)
const line = (lines: readonly CostLine[], name: string) => lines.find((row) => row.name === name)!

describe('independent cockpit operating costs', () => {
  it('explains five distinct city scenarios through actual line formulas, not a shared 57% total', () => {
    const result = operatingCosts(data(['武汉', '成都', '上海', '北京', '广州']))
    expect(new Set(result.rows.map((row) => row.cost)).size).toBe(5)
    expect(result.rows.every((row) => row.cost !== row.sales * 0.57 && row.sample)).toBe(true)
    expect(result.rows.map((row) => row.assumption?.profile)).toEqual([
      'logistics',
      'loss',
      'people',
      'premises',
      'marketing',
    ])
    expect(line(result.rows[0].lines, '运费').amount).toBe(9000)
    expect(line(result.rows[1].lines, '损耗').amount).toBe(4500)
    expect(line(result.rows[2].lines, '底薪绩效').amount).toBe(6300)
    expect(line(result.rows[3].lines, '仓储').amount).toBe(3000)
    expect(line(result.rows[3].lines, '办公室租金').amount).toBe(4200)
    expect(line(result.rows[4].lines, '营销费').amount).toBe(8400)
    for (const row of result.rows) {
      expect(row.assumption?.explanation).toContain('演示')
      for (const item of row.lines) {
        const basis = item.basis!
        expect(item.amount).toBeCloseTo(
          basis.salesBase * basis.salesRate + basis.days * basis.dailyAmount,
          2,
        )
      }
    }
  })

  it.each([0, 4321.09, -125.37])(
    'preserves recorded cost %s without adding sample costs or fictional details',
    (amount) => {
      const source = data()
      source.cityCostRanking = [actual('武汉', amount)]
      const result = operatingCosts(source)
      expect(result).toMatchObject({ cost: amount, profit: 100000 - amount, sample: false })
      expect(result.rows[0]).toMatchObject({
        cost: amount,
        sample: false,
        detailStatus: 'unallocated',
      })
      expect(result.rows[0].assumption).toBeUndefined()
      expect(result.lines).toEqual([
        {
          group: '未分项',
          category: '未分项',
          name: '已入账成本（未提供分项）',
          amount,
          sample: false,
          source: 'actual-total',
        },
      ])
    },
  )

  it('fills only missing cities, keeps zero facts, and marks mixed cost and profit as sample', () => {
    const source = data(['上海', '武汉', '北京'])
    source.cityCostRanking = [actual('上海', 0), actual('武汉', 123456, 0)]
    const result = operatingCosts(source)
    expect(result.rows[0]).toMatchObject({ cost: 0, sample: false })
    expect(result.rows[1]).toMatchObject({ sample: true })
    expect(result.rows[1].cost).not.toBe(123456)
    expect(result.rows[2].sample).toBe(true)
    expect(result.sample).toBe(true)
    expect(result.profit).toBe(result.sales - result.cost)
    expect(line(result.lines, '已入账成本（未提供分项）')).toMatchObject({
      amount: 0,
      sample: false,
    })
    expect(result.lines.filter((row) => row.group !== '未分项').every((row) => row.sample)).toBe(
      true,
    )
  })

  it('retains cost-only cities and uses the sales ranking where both sources exist', () => {
    const source = data(['武汉'])
    source.citySalesRanking[0].salesAmount = 123.45
    source.cityCostRanking = [actual('武汉', 100), { ...actual('北京', 900), salesAmount: 500 }]
    source.metrics = []
    const result = operatingCosts(source)
    expect(result.rows).toMatchObject([
      { key: '武汉', sales: 123.45, cost: 100, profit: 23.45 },
      { key: '北京', sales: 500, cost: 900, profit: -400 },
    ])
    expect(result).toMatchObject({ sales: 623.45, cost: 1000, profit: -376.55, sample: false })
  })

  it('keeps city facts even when the global cost metric disagrees or is zero', () => {
    const source = data()
    source.cityCostRanking = [actual('武汉', 321)]
    source.metrics.push(metric('city_cost_amount', 0))
    expect(operatingCosts(source)).toMatchObject({ cost: 321, sample: false })
  })

  it('conserves cents across cities, merged lines, groups, categories and profit', () => {
    const source = data(['上海', '武汉', '北京', '成都', '广州'])
    source.citySalesRanking = source.citySalesRanking.map((row, index) => ({
      ...row,
      salesAmount: 123.47 + index / 100,
    }))
    source.cityCostRanking = [actual('上海', 23.47), actual('北京', -0.01)]
    const result = operatingCosts(source)
    for (const row of result.rows) {
      expect(sumCents(row.lines)).toBe(Math.round(row.cost * 100))
      expect(Math.round(row.sales * 100) - Math.round(row.cost * 100)).toBe(
        Math.round(row.profit * 100),
      )
    }
    expect(sumCents(result.rows.map((row) => ({ amount: row.cost })))).toBe(sumCents(result.lines))
    expect(sumCents(result.lines)).toBe(Math.round(result.cost * 100))
    for (const field of ['group', 'category'] as const) {
      const names = [...new Set(result.lines.map((row) => row[field]))]
      const total = names.reduce(
        (sum, name) => sum + sumCents(result.lines.filter((row) => row[field] === name)),
        0,
      )
      expect(total).toBe(Math.round(result.cost * 100))
    }
    expect(aggregateCostLines(result.rows.flatMap((row) => row.lines))).toEqual(result.lines)
  })

  it('rounds a half-cent line before aggregating rather than losing it to floating point', () => {
    const source = data()
    source.citySalesRanking[0].salesAmount = 32.5
    const result = operatingCosts(source)
    expect(line(result.rows[0].lines, '货品').amount).toBe(10.08)
    expect(sumCents(result.lines)).toBe(Math.round(result.cost * 100))
  })

  it('preserves the goods/people/premises mapping, five categories and supplementary marketing', () => {
    expect([...new Set(sampleCostLines.map((row) => row.group))]).toEqual(['货', '人', '场'])
    expect(new Set(sampleCostLines.map((row) => row.category))).toEqual(
      new Set(['货品成本', '物流成本', '仓库成本', '人力成本', '房租成本', '其他补充项']),
    )
    expect(sampleCostLines.filter((row) => row.group === '人').map((row) => row.name)).toEqual([
      '底薪绩效',
      '提成',
      '激励',
      '兼职',
    ])
    expect(sampleCostLines.filter((row) => row.name === '损耗')).toHaveLength(1)
    expect(sampleCostRules.usage).toContain('不用于实际成本排名')
  })

  it('prorates only daily amounts using inclusive Shanghai days, with no month or refresh variation', () => {
    const source = data()
    source.to = '2026-09-01T23:59:59+08:00'
    const first = operatingCosts(source).rows[0]
    source.to = '2026-09-02T23:59:59+08:00'
    const second = operatingCosts(source).rows[0]
    expect(line(second.lines, '办公室租金').amount).toBe(line(first.lines, '办公室租金').amount * 2)
    expect(line(second.lines, '货品').amount).toBe(line(first.lines, '货品').amount)
    source.from = '2026-10-01T00:00:00+08:00'
    source.to = '2026-10-02T23:59:59+08:00'
    expect(operatingCosts(source).rows[0]).toEqual(second)
    source.from = '2024-02-28T00:00:00+08:00'
    source.to = '2024-03-01T23:59:59+08:00'
    expect(line(operatingCosts(source).rows[0].lines, '仓储').basis?.days).toBe(3)
    source.from = '2026-08-31T16:00:00Z'
    source.to = '2026-09-01T15:59:59Z'
    expect(operatingCosts(source).rows[0]).toEqual(first)
  })

  it.each([
    ['invalid', '2026-09-30'],
    ['2026-02-30', '2026-03-01'],
    ['2026-09-02', '2026-09-01'],
    ['2026-09-01T00:00:00', '2026-09-30'],
  ])('rejects undefined sample date assumptions: %s to %s', (from, to) => {
    expect(() => operatingCosts({ ...data(), from, to })).toThrow(RangeError)
  })

  it('keeps city scenarios stable across filtering, order, time and random state', () => {
    const source = data(['A', 'B', 'C', 'D', 'E'])
    const expected = operatingCosts(source)
    expect(new Set(expected.rows.map((row) => row.assumption?.profile)).size).toBe(5)
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('random forbidden')
    })
    const now = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('wall clock forbidden')
    })
    try {
      const reverse = operatingCosts({
        ...source,
        citySalesRanking: [...source.citySalesRanking].reverse(),
      })
      for (const row of expected.rows) {
        expect(reverse.rows.find((item) => item.key === row.key)).toEqual(row)
        expect(operatingCosts(data([row.key])).rows[0]).toEqual(row)
      }
    } finally {
      random.mockRestore()
      now.mockRestore()
    }
  })

  it('uses nonnegative sample sales bases while retaining zero/negative real sales and deficits', () => {
    const source = data(['武汉', '北京'])
    source.citySalesRanking = [city('武汉', 0), city('北京', -100)]
    source.metrics = [metric('sales_amount', -100)]
    const result = operatingCosts(source)
    expect(result.sales).toBe(-100)
    expect(result.rows[1].sales).toBe(-100)
    expect(result.rows.every((row) => row.profit < 0 && row.sample)).toBe(true)
    expect(result.lines.every((row) => row.amount >= 0)).toBe(true)
    expect(result).not.toHaveProperty('risks')
    expect(result).not.toHaveProperty('actions')
  })

  it('keeps scope totals without inventing cities; a zero summary alone is not a cost record', () => {
    const source = data([])
    source.metrics = [metric('sales_amount', 2000), metric('city_cost_amount', 0)]
    const result = operatingCosts(source)
    expect(result.rows).toEqual([])
    expect(result).toMatchObject({ sales: 2000, sample: true })
    expect(sumCents(result.lines)).toBe(Math.round(result.cost * 100))
    source.metrics[1].value = 123.45
    expect(operatingCosts(source)).toMatchObject({ rows: [], cost: 123.45, sample: false })
    expect(operatingCosts(source).lines[0].group).toBe('未分项')
  })

  it('does not deduct ERP reference costs, infer payroll from sales staff, or mutate its input', () => {
    const source = data()
    const original = structuredClone(source)
    const before = operatingCosts(source)
    const enriched = {
      ...source,
      metrics: [
        ...source.metrics,
        metric('estimated_cost_amount', 900000),
        metric('cost_coverage_rate', 100),
      ],
      salesRanking: [{ ...city('secret-person', 999999), salary: 99999 }],
      generatedAt: '2099-01-01T00:00:00+08:00',
      risks: [{ name: 'unrelated-risk' }],
    }
    expect(operatingCosts(enriched)).toEqual(before)
    expect(source).toEqual(original)
    expect(JSON.stringify(before)).not.toContain('secret-person')
    expect(before.rows.flatMap((row) => row.lines).every((row) => !('ownerStaffCode' in row))).toBe(
      true,
    )
  })

  it('rejects an invalid recorded amount instead of fabricating zero or replacing it with sample', () => {
    const source = data()
    source.cityCostRanking = [actual('武汉', NaN)]
    expect(() => operatingCosts(source)).toThrow('已入账成本无效')
  })

  it('aggregates without mutating input or disguising mixed detail provenance', () => {
    const sample = operatingCosts(data()).rows[0].lines[0]
    const input: CostLine[] = [
      { ...sample, amount: 0.1 },
      { ...sample, amount: 0.2, sample: false, source: 'actual-total' },
    ]
    const original = structuredClone(input)
    expect(aggregateCostLines(input)).toEqual([
      {
        group: sample.group,
        category: sample.category,
        name: sample.name,
        amount: 0.3,
        sample: true,
        source: 'mixed',
      },
    ])
    expect(input).toEqual(original)
  })

  it('retains SKU series, flavor and packaging as independent fixed-batch samples', () => {
    expect(sampleSkuCosts).toHaveLength(8)
    expect(sampleSkuCosts.every((row) => row.sample && row.series && row.name && row.sku)).toBe(
      true,
    )
    expect(sampleSkuCosts[0]).toMatchObject({
      series: '粉菜面蛋',
      name: '金汤肥牛味粉面菜蛋',
      sku: '12桶/箱',
      price: 53,
    })
    expect(sampleSkuCosts.some((row) => row.series === '干拌面')).toBe(true)
    expect(sampleCostRules.sku).toContain('不随城市或日期变化')
    const result = operatingCosts(data())
    expect(result.lines.some((row) => sampleSkuCosts.some((sku) => sku.name === row.name))).toBe(
      false,
    )
  })
})
