import { describe, expect, it } from 'vitest'
import type { SupplyDashboardRankingItem, SupplyDashboardTargetCompletionItem } from '@/api/core/bi'
import { targetCompletionFigure } from '@/views/supply-chain/bi/cockpit-targets'
import { salesMovementFigure } from '@/views/supply-chain/bi/cockpit-movement'
import { bars, heatmap, lines, pareto } from '@/views/supply-chain/bi/cockpit-charts'

const target = (code: string, actual: number, goal: number) =>
  ({
    dimensionCode: 'S1',
    dimensionName: '测试销售',
    dimensionType: 'SALES',
    metricCode: code,
    metricName: code,
    targetValue: goal,
    actualValue: actual,
    achievementRate: 0,
  }) as SupplyDashboardTargetCompletionItem
const person = (id: string, value: number) =>
  ({
    dimensionCode: id,
    dimensionName: `销售${id}`,
    regionCode: 'BJ',
    regionName: '北京',
    salesAmount: value,
    paidAmount: value / 2,
  }) as SupplyDashboardRankingItem
const series = (option: unknown) =>
  (option as { series: { type: string; data: { value: unknown; rowKey: string }[] }[] }).series

describe('经营判断图表与维度', () => {
  it('销售、回款、客户目标独立比较达成率，保留超过100%的实际值和缺失目标', () => {
    const figure = targetCompletionFigure(
      [
        target('SALES_AMOUNT', 12500.51, 10000),
        target('PAID_AMOUNT', 2000, 5000),
        target('CONTACTED_CUSTOMER', 12, 20),
        target('COOPERATED_CUSTOMER', 2, 0),
      ],
      false,
      4,
    )
    expect(figure.span).toBe(12)
    expect(figure.compact).toBe(false)
    expect(series(figure.option)[0].data.map((row) => row.value)).toEqual([
      [0, 0, 125.0051],
      [1, 0, 40],
      [2, 0, 60],
    ])
    expect(figure.rows[0].cells).toMatchObject({
      实际: '¥12,500.51',
      目标: '¥10,000.00',
      缺口: '¥0.00',
    })
    expect(figure.rows[2].cells.实际).toBe('12')
    expect(figure.rows[3].cells.达成率).toBe('—')
    expect(series(figure.option)[0].data[0].rowKey).toBe(figure.rows[0].key)
    expect(figure.rows[0]).toMatchObject({ ownerStaffCode: 'S1', kind: 'target' })
  })
  it('重复期间目标从分子分母汇总，不平均各月百分比', () => {
    const figure = targetCompletionFigure(
      [target('SALES_AMOUNT', 80, 100), target('SALES_AMOUNT', 20, 50)],
      true,
      6,
    )
    expect(figure.rows).toHaveLength(1)
    expect(figure.rows[0].cells.达成率).toBe('66.7%')
    expect(figure.rows[0].regionCode).toBe('S1')
  })
  it('无目标仅显示紧凑配置入口，不用0%填充', () => {
    const figure = targetCompletionFigure([], false, 4)
    expect(figure).toMatchObject({ compact: true, rows: [], emptyAction: 'target' })
  })
  it('部分月份目标在图中和明细中明确标注，不能表示全期间达标', () => {
    const figure = targetCompletionFigure(
      [{ ...target('SALES_AMOUNT', 120, 100), configuredMonthCount: 1, periodMonthCount: 3 }],
      true,
      6,
    )
    expect(figure.rows[0].cells.目标覆盖).toBe('1/3个月 · 部分月份未配置')
    expect(figure.note).toContain('部分月份未配置')
    const option = figure.option as {
      series: { label: { formatter: (raw: unknown) => string } }[]
      tooltip: { formatter: (raw: unknown) => string }
    }
    const point = { data: { value: [0, 0, 120] } }
    expect(option.series[0].label.formatter(point)).toBe('120.0%*')
    expect(option.tooltip.formatter(point)).toContain('1/3个月，部分月份未配置')
  })
  it('前期变化只连接两期均有记录的人员，并保留可下钻身份', () => {
    const figure = salesMovementFigure(
      [person('1', 60), person('2', 70), person('new', 100)],
      [person('1', 100), person('2', 20)],
      'salesAmount',
      '2026-08-01',
      '2026-08-31',
    )!
    expect(figure.rows.map((row) => row.code)).toEqual(['2', '1'])
    expect(figure.rows[0].cells.增减金额).toBe('¥50.00')
    expect(series(figure.option)[0].data).toEqual([
      { value: 20, rowKey: '2' },
      { value: 70, rowKey: '2' },
    ])
    expect(series(figure.option).every((row) => row.type === 'line')).toBe(true)
    expect(figure.rows[0]).toMatchObject({ kind: 'sales', regionCode: 'BJ', ownerStaffCode: '2' })
    expect(salesMovementFigure([person('1', 20)], [], 'paidAmount', '', '')).toBeNull()
  })
  it('金额图表悬浮统一以万显示，原数值不变且非金额保留单位', () => {
    const rows = [{ key: 'x', name: '甲', values: [226320.94] }]
    for (const chart of [bars(rows, [{ name: '销售额' }]), lines(rows, [{ name: '销售额' }])]) {
      const tooltip = chart.tooltip as { valueFormatter: (value: unknown) => string }
      expect(tooltip.valueFormatter(226320.94)).toBe('¥22.63万')
      expect(tooltip.valueFormatter(null)).toBe('—')
      expect(series(chart)[0].data[0].value).toBe(226320.94)
    }
    const matrix = heatmap(rows, ['销售额'], { money: true })
    expect(
      (matrix.tooltip as { formatter: (value: unknown) => string }).formatter({
        data: { value: [0, 0, 226320.94] },
      }),
    ).toContain('¥22.63万')
    const contribution = pareto(rows)
    expect(
      (contribution.tooltip as { formatter: (value: unknown) => string }).formatter({
        data: { rowKey: 'x' },
      }),
    ).toContain('¥22.63万')
    expect(
      (
        bars(rows, [{ name: '库存' }], { unit: '箱' }).tooltip as {
          valueFormatter: (value: unknown) => string
        }
      ).valueFormatter(12.5),
    ).toBe('12.5箱')
  })
})
