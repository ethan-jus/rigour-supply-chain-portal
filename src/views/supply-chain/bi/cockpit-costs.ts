import type { SupplyDashboardOverview } from '@/api/core/bi'
import { businessPeriodDays } from '@/utils/business-date'

export type OperatingCostData = Pick<
  SupplyDashboardOverview,
  'from' | 'to' | 'metrics' | 'citySalesRanking' | 'cityCostRanking'
>
export type CostGroup = '货' | '人' | '场' | '未分项'
export type CostCategory =
  '货品成本' | '物流成本' | '人力成本' | '仓库成本' | '房租成本' | '其他补充项' | '未分项'

export const sampleCostRules = {
  date: '按查询起止时间对应的北京时间日期计算，包含首尾日；日固定费用乘天数，变动费用乘所选范围非负销售额。同天数同销售额不因月份或刷新时间变化。',
  profile:
    '城市别名选择固定演示情景；其他城市按编码字符码之和对情景数取余选择。情景不表示该城市的真实费用水平。',
  personnel: '人力仅为城市/期间费用样例；不使用人员名单、人数、业绩或真实工资，不用于员工考核。',
  actual:
    '有成本记录的城市保留已入账总额，包括零和负调整；接口没有分项，保留未分项余额，不追加或拆分样例。',
  procurement: 'ERP 采购参考价与完整经营成本没有已定义的抵扣关系，本模块不合并或抵扣估算采购成本。',
  sku: 'SKU 为固定批次的独立演示样例；价格、数量、损耗率不随城市或日期变化，不计入城市费用，不代表 ERP 采购事实。',
  usage: '含样例的成本和结余仅供演示，不用于实际成本排名、经营预警或员工考核；结余不是财务净利润。',
} as const

// These are independent line formulas, never shares used to split an actual total.
export const sampleCostLines = [
  { name: '货品', group: '货', category: '货品成本', salesRate: 0.31, dailyAmount: 0 },
  { name: '运费', group: '货', category: '物流成本', salesRate: 0.035, dailyAmount: 0 },
  { name: '损耗', group: '货', category: '货品成本', salesRate: 0.012, dailyAmount: 0 },
  { name: '底薪绩效', group: '人', category: '人力成本', salesRate: 0, dailyAmount: 120 },
  { name: '提成', group: '人', category: '人力成本', salesRate: 0.02, dailyAmount: 0 },
  { name: '激励', group: '人', category: '人力成本', salesRate: 0, dailyAmount: 10 },
  { name: '兼职', group: '人', category: '人力成本', salesRate: 0, dailyAmount: 12 },
  { name: '仓储', group: '场', category: '仓库成本', salesRate: 0, dailyAmount: 40 },
  { name: '办公室租金', group: '场', category: '房租成本', salesRate: 0, dailyAmount: 50 },
  { name: '营销费', group: '场', category: '其他补充项', salesRate: 0.012, dailyAmount: 20 },
] as const satisfies readonly {
  name: string
  group: CostGroup
  category: CostCategory
  salesRate: number
  dailyAmount: number
}[]

type CostLineName = (typeof sampleCostLines)[number]['name']
interface SampleProfile {
  key: string
  name: string
  explanation: string
  aliases: readonly string[]
  overrides: Partial<Record<CostLineName, { salesRate?: number; dailyAmount?: number }>>
}

export const sampleCostProfiles: readonly SampleProfile[] = [
  {
    key: 'logistics',
    name: '物流投入样例',
    aliases: ['武汉', 'WH', 'WUHAN', '420100'],
    explanation: '演示配送费用较高：运费按销售额的 9% 计算。',
    overrides: { 运费: { salesRate: 0.09 } },
  },
  {
    key: 'loss',
    name: '损耗投入样例',
    aliases: ['成都', 'CD', 'CHENGDU', '510100'],
    explanation: '演示货品损耗较高：损耗按销售额的 4.5% 单独计入一次。',
    overrides: { 损耗: { salesRate: 0.045 } },
  },
  {
    key: 'people',
    name: '人力投入样例',
    aliases: ['上海', 'SH', 'SHANGHAI', '310000', '310100'],
    explanation:
      '演示城市团队投入较高：底薪绩效 210 元/日，提成 4.5%，激励 20 元/日，兼职 30 元/日。',
    overrides: {
      底薪绩效: { dailyAmount: 210 },
      提成: { salesRate: 0.045 },
      激励: { dailyAmount: 20 },
      兼职: { dailyAmount: 30 },
    },
  },
  {
    key: 'premises',
    name: '仓储租金投入样例',
    aliases: ['北京', 'BJ', 'BEIJING', '110000', '110100'],
    explanation: '演示场地投入较高：仓储 100 元/日，办公室租金 140 元/日。',
    overrides: { 仓储: { dailyAmount: 100 }, 办公室租金: { dailyAmount: 140 } },
  },
  {
    key: 'marketing',
    name: '营销投入样例',
    aliases: ['广州', 'GZ', 'GUANGZHOU', '440100'],
    explanation: '演示试吃和活动投入较高：营销费为销售额的 6% 加 80 元/日。',
    overrides: { 营销费: { salesRate: 0.06, dailyAmount: 80 } },
  },
]

const baselineProfile: SampleProfile = {
  key: 'unscoped',
  name: '未分城市汇总样例',
  aliases: [],
  overrides: {},
  explanation: '没有城市明细时仅生成范围汇总样例，不虚构城市或城市数量。',
}

export interface CostLine {
  group: CostGroup
  category: CostCategory
  name: string
  amount: number
  sample: boolean
  source: 'sample' | 'actual-total' | 'mixed'
  basis?: { salesBase: number; salesRate: number; dailyAmount: number; days: number }
}

export interface OperatingCostRow {
  key: string
  name: string
  sales: number
  cost: number
  profit: number
  sample: boolean
  lines: CostLine[]
  detailStatus: 'sample' | 'unallocated'
  assumption?: { profile: string; name: string; explanation: string; assignment: string }
}

export interface OperatingCosts {
  rows: OperatingCostRow[]
  sales: number
  cost: number
  profit: number
  sample: boolean
  lines: CostLine[]
  rules: typeof sampleCostRules
}

const cents = (value: number) =>
  Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON * Math.abs(value)) * 100)
const money = (value: number) => cents(value) / 100
const sumAmounts = (lines: readonly { amount: number }[]) =>
  lines.reduce((total, line) => total + cents(line.amount), 0) / 100
const finite = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

function metric(data: OperatingCostData, code: string) {
  return finite(data.metrics.find((item) => item.metricCode === code)?.value)
}

function periodDays(from: string, to: string): number {
  return businessPeriodDays(from, to)
}

function profileForCity(key: string, name: string) {
  const normalize = (value: string) => value.trim().toUpperCase().replace(/市$/, '')
  const match = sampleCostProfiles.find((profile) =>
    profile.aliases.some((alias) => alias === normalize(key) || alias === normalize(name)),
  )
  const index =
    Array.from(key).reduce((total, char) => total + char.codePointAt(0)!, 0) %
    sampleCostProfiles.length
  return {
    profile: match ?? sampleCostProfiles[index],
    assignment: match ? '城市别名对应的固定演示情景，非实际成本判断' : sampleCostRules.profile,
  }
}

function sampleLines(sales: number, days: number, profile: SampleProfile): CostLine[] {
  const salesBase = Math.max(0, sales)
  return sampleCostLines.map((line) => {
    const salesRate = profile.overrides[line.name]?.salesRate ?? line.salesRate
    const dailyAmount = profile.overrides[line.name]?.dailyAmount ?? line.dailyAmount
    return {
      group: line.group,
      category: line.category,
      name: line.name,
      amount: money(salesBase * salesRate + dailyAmount * days),
      sample: true,
      source: 'sample',
      basis: { salesBase, salesRate, dailyAmount, days },
    }
  })
}

function actualLines(cost: number): CostLine[] {
  return [
    {
      group: '未分项',
      category: '未分项',
      name: '已入账成本（未提供分项）',
      amount: money(cost),
      sample: false,
      source: 'actual-total',
    },
  ]
}

/** Merge matching lines in cents; aggregated bases are deliberately not inferred. */
export function aggregateCostLines(lines: readonly CostLine[]): CostLine[] {
  const grouped = new Map<string, { line: CostLine; amountInCents: number }>()
  for (const line of lines) {
    const key = JSON.stringify([line.group, line.category, line.name])
    const existing = grouped.get(key)
    if (existing) {
      existing.amountInCents += cents(line.amount)
      existing.line.sample ||= line.sample
      if (existing.line.source !== line.source) existing.line.source = 'mixed'
    } else {
      grouped.set(key, {
        line: {
          group: line.group,
          category: line.category,
          name: line.name,
          amount: 0,
          sample: line.sample,
          source: line.source,
        },
        amountInCents: cents(line.amount),
      })
    }
  }
  return [...grouped.values()].map(({ line, amountInCents }) => ({
    ...line,
    amount: amountInCents / 100,
  }))
}

/** Presentation-only costs; no model/chart imports, personnel data, writes or risk output. */
export function operatingCosts(data: OperatingCostData): OperatingCosts {
  const actuals = new Map(
    (data.cityCostRanking || [])
      .filter((row) => row.recordCount > 0)
      .map((row) => [row.regionCode, row]),
  )
  const cities = new Map(
    (data.citySalesRanking || []).map((row) => [
      row.dimensionCode,
      {
        key: row.dimensionCode,
        name: row.dimensionName || row.dimensionCode,
        sales: money(finite(row.salesAmount) ?? 0),
      },
    ]),
  )
  for (const row of actuals.values()) {
    if (!cities.has(row.regionCode))
      cities.set(row.regionCode, {
        key: row.regionCode,
        name: row.regionName || row.regionCode,
        sales: money(finite(row.salesAmount) ?? 0),
      })
  }

  const rows: OperatingCostRow[] = [...cities.values()].map((city) => {
    const actual = actuals.get(city.key)
    if (actual) {
      if (finite(actual.costAmount) === null)
        throw new RangeError(`城市 ${city.key} 的已入账成本无效`)
      const cost = money(actual.costAmount)
      return {
        ...city,
        cost,
        profit: money(city.sales - cost),
        sample: false,
        lines: actualLines(cost),
        detailStatus: 'unallocated',
      }
    }
    const { profile, assignment } = profileForCity(city.key, city.name)
    const lines = sampleLines(city.sales, periodDays(data.from, data.to), profile)
    const cost = sumAmounts(lines)
    return {
      ...city,
      cost,
      profit: money(city.sales - cost),
      sample: true,
      lines,
      detailStatus: 'sample',
      assumption: {
        profile: profile.key,
        name: profile.name,
        explanation: profile.explanation,
        assignment,
      },
    }
  })
  const sales = money(
    metric(data, 'sales_amount') ?? sumAmounts(rows.map((row) => ({ amount: row.sales }))),
  )
  // A zero summary alone cannot distinguish no records from recorded zero cost.
  const summary = metric(data, 'city_cost_amount')
  const lines = rows.length
    ? aggregateCostLines(rows.flatMap((row) => row.lines))
    : summary !== null && summary !== 0
      ? actualLines(summary)
      : sampleLines(sales, periodDays(data.from, data.to), baselineProfile)
  const cost = sumAmounts(lines)
  return {
    rows,
    sales,
    cost,
    profit: money(sales - cost),
    sample: lines.some((line) => line.sample),
    lines,
    rules: sampleCostRules,
  }
}

export const sampleSkuCosts = [
  {
    category: '方便面',
    series: '粉菜面蛋',
    name: '金汤肥牛味粉面菜蛋',
    sku: '12桶/箱',
    price: 53,
    quantity: 320,
    loss: 0.012,
  },
  {
    category: '方便面',
    series: '粉菜面蛋',
    name: '酸麻叉烧味粉面菜蛋',
    sku: '12桶/箱',
    price: 73,
    quantity: 180,
    loss: 0.018,
  },
  {
    category: '方便面',
    series: '干拌面',
    name: '油泼辣子拌面',
    sku: '12桶/箱',
    price: 51,
    quantity: 430,
    loss: 0.01,
  },
  {
    category: '方便面',
    series: '干拌面',
    name: '葱油鸡肉菌菇拌面',
    sku: '12桶/箱',
    price: 72,
    quantity: 210,
    loss: 0.014,
  },
  {
    category: '水类',
    series: '瓶装水',
    name: '饮用纯净水',
    sku: '550ml×24瓶/箱',
    price: 18,
    quantity: 520,
    loss: 0.008,
  },
  {
    category: '水类',
    series: '矿泉水',
    name: '天然矿泉水',
    sku: '380ml×24瓶/箱',
    price: 22,
    quantity: 240,
    loss: 0.011,
  },
  {
    category: '台泥',
    series: '华彩',
    name: '澳洋华彩A300',
    sku: '中式A300',
    price: 255,
    quantity: 65,
    loss: 0.006,
  },
  {
    category: '台泥',
    series: '斯诺克',
    name: '澳洋斯诺克极光',
    sku: '极光',
    price: 870,
    quantity: 24,
    loss: 0.005,
  },
].map((row) => ({ ...row, sample: true as const }))
