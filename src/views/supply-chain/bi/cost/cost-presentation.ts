import { costLabel } from '../../cost/cost-dictionaries'
import type { EChartsCoreOption } from 'echarts/core'
import type {
  CostCategory,
  CostGroup,
  CostMonth,
  CostRecord,
  CostReport,
  CostScope,
} from '@/api/core/bi-cost-dashboard'
export const categories: Record<CostCategory, string> = {
  warehouse: '仓储费用',
  marketing: '营销费用',
  office: '办公费用',
  freight: '物流运输费用',
  labor: '人力薪酬',
  expense: '员工报销',
  premises_unknown: '待分类场地费用',
  purchase: '采购成本',
  loss: '商品损耗',
}
export const dimensions: Record<CostCategory, string[]> = {
  freight: [
    'department',
    'employee',
    'leg',
    'method',
    'carrier',
    'feeType',
    'deliveryMode',
    'route',
  ],
  warehouse: ['feeType', 'premises', 'contract'],
  office: ['premises', 'contract', 'type', 'employee'],
  labor: ['employee', 'department'],
  marketing: ['type', 'channel', 'employee', 'payee'],
  expense: ['type', 'employee', 'department', 'trip', 'destination', 'payee'],
  purchase: ['component', 'department', 'supplier', 'warehouse', 'product'],
  loss: ['product', 'lossReason', 'warehouse'],
  premises_unknown: ['premises', 'contract'],
}
export const dimensionNames: Record<string, string> = {
  leg: '运输类型',
  carrier: '物流公司',
  method: '运输渠道',
  feeType: '费用项目',
  deliveryMode: '配送方式',
  component: '采购成本构成',
  premises: '仓库或场地',
  contract: '合同编号',
  type: '费用类型',
  channel: '渠道',
  employee: '员工',
  department: '部门',
  supplier: '供应商',
  product: '商品规格',
  lossReason: '损耗原因',
  route: '运输路线',
  warehouse: '仓库或发生地点',
  payee: '收款方或合作方',
  trip: '出差或报销事项',
  destination: '出差目的地',
}
export const palette = ['#77aaf4', '#70c9bc', '#aaa1ef', '#e5b473', '#8dbbde', '#a4adb9']
export const categoryColor = (key: string, i: number) =>
  palette[Math.max(0, Object.keys(categories).indexOf(key)) % palette.length] ||
  palette[i % palette.length]
/** 精确金额仅格式化字符串；Number转换只用于图形坐标，不用于业务合计。 */
export function money(value: string | null | undefined): string {
  if (value == null) return '—'
  const [integer, fraction = '00'] = value.split('.')
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`
}
export const signed = (v: string | null | undefined) =>
  v == null ? '—' : `${Number(v) > 0 ? '+' : ''}${money(v)}`
export const percent = (v: string | null | undefined) => (v == null ? '—' : `${v}%`)
export const paymentStatusNames: Record<string, string> = {
  PAID: '已付款',
  UNPAID: '未付款',
  PARTIAL_PAID: '部分付款',
  NOT_REQUIRED: '无需付款',
  NEEDS_REVIEW: '待核对',
  UNKNOWN: '未记录',
}
export const statusName = (v: string) =>
  ({
    CONFIRMED: '已确认',
    DRAFT: '待确认',
    VOID: '已作废',
    ...paymentStatusNames,
  })[v] || '未记录'

/** 运输资料完整度与其他成本确认状态分别按来源呈现。 */
export function recordStatusName(row: Pick<CostRecord, 'source' | 'status' | 'costTreatment'>) {
  if (row.costTreatment === 'REVIEW') return '待核对'
  if (row.source === 'ORDER')
    return { CONFIRMED: '已完善', DRAFT: '待完善', VOID: '已作废' }[row.status] || '未记录'
  return statusName(row.status)
}

export function overviewCards(report: CostReport, available: CostCategory[]) {
  const scopes: { scope: CostScope; label: string }[] = [
    { scope: 'opex', label: '经营费用' },
    { scope: 'purchase', label: '采购成本' },
    { scope: 'loss', label: '商品损耗' },
  ]
  return scopes
    .filter((s) =>
      s.scope === 'opex'
        ? available.some((c) => !['purchase', 'loss'].includes(c))
        : available.includes(s.scope),
    )
    .map((s) => {
      const summary = report.scopeSummaries?.find((item) => item.scope === s.scope)
      const currentScope = report.scope === s.scope
      return {
        ...s,
        amount:
          summary?.current.amount ??
          (currentScope
            ? report.current.amount
            : s.scope === 'purchase'
              ? report.purchase
              : report.loss),
        count: summary?.current.count ?? (currentScope ? report.current.count : undefined),
        comparable:
          summary?.comparisonAvailable ?? (currentScope && report.meta.comparisonAvailable),
        delta: summary ? summary.delta : currentScope ? report.delta : null,
        growth: summary ? summary.growth : currentScope ? report.growth : null,
        reviewCount:
          summary?.current.reviewCount ?? (currentScope ? report.current.reviewCount || 0 : 0),
        components: summary?.components || [],
      }
    })
}
/** 分组键携带来源字典编码，字典新增项无需维护前端枚举。 */
const dictionaryKey = /^dict:([A-Z][A-Z0-9_]*):(.+)$/

export function dictionaryCodeForKey(key: string | null | undefined): string | undefined {
  return key ? dictionaryKey.exec(key)?.[1] : undefined
}

export function dictionaryValue(key: string, fallback = key): string {
  // 看板按配送用途归集，包含未关联销售单的运输记录。
  if (key === 'dict:COST_TRANSPORT_PURPOSE:DELIVERY') return '订单配送'
  const match = dictionaryKey.exec(key)
  if (!match) return fallback
  const code = match[2]!
  const label = costLabel(match[1]!, code)
  if (key === 'dict:COST_LOGISTICS_LEG:DELIVERY' && label === code) return '城市仓到客户'
  return label === code && fallback !== key ? fallback : label
}
export function recordItem(row: Pick<CostRecord, 'itemKey' | 'itemName'>): string {
  return !row.itemKey || row.itemKey === 'UNKNOWN'
    ? ''
    : dictionaryValue(row.itemKey, row.itemName || row.itemKey)
}

/** 费用归集后的类别不改变原单费用类型的字典。 */
export function detailDimensionValue(
  record: Pick<CostRecord, 'source' | 'category'>,
  name: string,
  value: string,
) {
  if (value.startsWith('dict:')) return dictionaryValue(value)
  const dictionary = detailDimensionDictionary(record, name, value)
  return dictionary ? costLabel(dictionary, value) : value
}

export function detailDimensionDictionary(
  record: Pick<CostRecord, 'source' | 'category'>,
  name: string,
  value: string,
) {
  if (!value || value === '未记录') return undefined
  if (value.startsWith('dict:')) return dictionaryCodeForKey(value)
  return name === '运输环节'
    ? 'COST_LOGISTICS_LEG'
    : name === '运输渠道'
      ? 'COST_TRANSPORT_KIND'
      : name === '费用类型'
        ? record.source === 'HR' || record.category === 'expense'
          ? 'REIMBURSEMENT_EXPENSE_TYPE'
          : ['office', 'warehouse', 'premises_unknown'].includes(record.category)
            ? 'COST_PREMISES_TYPE'
            : 'MARKETING_EXPENSE_TYPE'
        : undefined
}
/** 详情只呈现适用于原业务的维度，必需资料缺失仍保留提示。 */
export function visibleDetailDimensions(
  record: Pick<CostRecord, 'source' | 'category'>,
  values: Record<string, string>,
) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([name, value]) =>
        !(
          record.source === 'ERP' &&
          ['office', 'warehouse', 'premises_unknown'].includes(record.category) &&
          name === '员工' &&
          (!value || value === '未记录')
        ) &&
        !(
          record.source === 'HR' &&
          values['费用类型'] === 'COURIER' &&
          ['出差或报销事项', '出差目的地', '收款方或合作方'].includes(name) &&
          (!value || value === '未记录')
        ),
    ),
  )
}
const theme = {
  color: palette,
  textStyle: { color: '#91a8bf', fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif' },
  animationDuration: 200,
}
function amountScale(values: number[]) {
  return values.some((value) => Math.abs(value) >= 10000) ? 10000 : 1
}
function amountAxis(values: number[]) {
  const scale = amountScale(values)
  const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })
  return {
    type: 'value' as const,
    min: values.some((value) => value < 0) ? undefined : 0,
    minInterval: 0.01,
    name: scale === 10000 ? '金额（万元）' : '金额（元）',
    nameTextStyle: { color: '#8da4bb' },
    axisLabel: {
      color: '#8da4bb',
      formatter: (value: number) => number.format(value / scale),
    },
    splitLine: { lineStyle: { color: '#233b51' } },
  }
}
export const ringOption = (groups: CostGroup[], category = false): EChartsCoreOption => ({
  ...theme,
  tooltip: {
    trigger: 'item',
    renderMode: 'richText',
    valueFormatter: (v: unknown) => `${money(String(v))} 元`,
  },
  series: [
    {
      type: 'pie',
      radius: ['62%', '82%'],
      center: ['50%', '50%'],
      label: { show: false },
      emphasis: { scale: true },
      data: groups.flatMap((g, i) =>
        Number(g.current) > 0
          ? [
              {
                id: g.key,
                name: g.label,
                value: Number(g.current),
                itemStyle: {
                  color: category ? categoryColor(g.key, i) : palette[i % palette.length],
                },
              },
            ]
          : [],
      ),
    },
  ],
})
export function bars(groups: CostGroup[], comparable: boolean, limit = 8): EChartsCoreOption {
  const list = groups.slice(0, limit)
  return {
    ...theme,
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      valueFormatter: (v: unknown) => `${money(String(v))} 元`,
    },
    legend: { top: 0, bottom: 'auto', textStyle: { color: '#9bb0c7' }, selectedMode: false },
    grid: { left: 8, right: 16, bottom: 12, top: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: list.map((g) => g.label),
      axisLabel: { color: '#a9bfd4', interval: 0, width: 72, overflow: 'break', lineHeight: 17 },
    },
    yAxis: amountAxis(
      list.flatMap((g) => [Number(g.current), ...(comparable ? [Number(g.previous)] : [])]),
    ),
    series: [
      {
        name: '本期',
        type: 'bar',
        barMaxWidth: 24,
        itemStyle: { color: '#78a9f0', borderRadius: [3, 3, 0, 0] },
        data: list.map((g) => ({ value: Number(g.current), id: g.key })),
      },
      ...(comparable
        ? [
            {
              name: '可比期',
              type: 'bar',
              barMaxWidth: 24,
              itemStyle: { color: '#4d667e' },
              data: list.map((g) => (g.previous == null ? null : Number(g.previous))),
            },
          ]
        : []),
    ],
  }
}
export function line(
  report: CostReport,
  { daily = false, comparisonLabel = '可比期' } = {},
): EChartsCoreOption {
  const amounts = (side: 'current' | 'previous') => {
    let previous = 0
    return report.cumulative.map((point) => {
      const value = point[side]
      if (value == null) return null
      if (!daily) return Number(value)
      // 按分取相邻累计值差额，保留冲减和没有发生额的日期。
      const cents = Math.round(Number(value) * 100)
      const amount = (cents - previous) / 100
      previous = cents
      return amount
    })
  }
  const current = amounts('current')
  const comparison = report.meta.comparisonAvailable ? amounts('previous') : []
  return {
    ...theme,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#557490' } },
      renderMode: 'richText',
      valueFormatter: (v: unknown) => `${money(String(v))} 元`,
    },
    legend: { top: 0, bottom: 'auto', textStyle: { color: '#9bb0c7' }, selectedMode: false },
    grid: { left: 8, right: 14, top: 52, bottom: 12, containLabel: true },
    xAxis: {
      type: 'category',
      data: report.cumulative.map((p) => p.key),
      boundaryGap: false,
      axisLabel: { color: '#8da4bb' },
    },
    yAxis: amountAxis([...current, ...comparison].filter((value) => value !== null)),
    series: [
      {
        name: '本期',
        type: 'line',
        showSymbol: false,
        data: current,
        itemStyle: { color: '#7dafff' },
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: 0.12 },
      },
      ...(report.meta.comparisonAvailable
        ? [
            {
              name: comparisonLabel,
              type: 'line',
              showSymbol: false,
              data: comparison,
              lineStyle: { type: 'dashed' },
              itemStyle: { color: '#8b9eaf' },
            },
          ]
        : []),
    ],
  }
}

/** 月份保持时间顺序；无可比数据保留缺口，不补零或跨缺口连线。 */
export function monthlyTrend(months: CostMonth[], comparisonLabel = '可比期'): EChartsCoreOption {
  const comparable = months.some((m) => m.previous !== null)
  return {
    ...theme,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(120, 169, 240, 0.08)' } },
      renderMode: 'richText',
      valueFormatter: (v: unknown) => `${money(String(v))} 元`,
    },
    legend: { top: 0, textStyle: { color: '#9bb0c7' }, selectedMode: false },
    grid: { left: 8, right: 14, top: 52, bottom: 12, containLabel: true },
    xAxis: {
      type: 'category',
      data: months.map((m) => `${m.month}月${m.month === 1 ? `\n${m.year}` : ''}`),
      axisLabel: { color: '#8da4bb' },
    },
    yAxis: amountAxis(
      months.flatMap((m) => [
        Number(m.current),
        ...(m.previous === null ? [] : [Number(m.previous)]),
      ]),
    ),
    series: [
      {
        name: '本期',
        type: 'bar',
        barMaxWidth: 28,
        itemStyle: { color: '#78a9f0', borderRadius: [3, 3, 0, 0] },
        data: months.map((m) => ({ id: `${m.year}-${m.month}`, value: Number(m.current) })),
      },
      ...(comparable
        ? [
            {
              name: comparisonLabel,
              type: 'line',
              connectNulls: false,
              silent: true,
              showSymbol: true,
              symbolSize: 5,
              lineStyle: { type: 'dashed' },
              itemStyle: { color: '#a9b8ca' },
              data: months.map((m) =>
                m.previous === null
                  ? null
                  : { id: `${m.year}-${m.month}`, value: Number(m.previous) },
              ),
            },
          ]
        : []),
    ],
  }
}
export function eventKey(event: unknown): string | undefined {
  return (event as { data?: { id?: string } })?.data?.id
}

export function matrixTotal(
  group: Pick<CostGroup, 'current' | 'delta'>,
  mode: 'amount' | 'share' | 'delta',
): string {
  if (mode === 'share') return Number(group.current) > 0 ? '100.0%' : '—'
  return mode === 'delta' ? signed(group.delta) : money(group.current)
}

function objectDictionary(report: CostReport, key: string) {
  if (key.startsWith('dict:')) return dictionaryCodeForKey(key)
  if (key.startsWith('code:REIMBURSEMENT_EXPENSE_TYPE:')) return 'REIMBURSEMENT_EXPENSE_TYPE'
  if (!key.startsWith('code:')) return undefined
  return report.dimension === 'leg'
    ? 'COST_LOGISTICS_LEG'
    : report.dimension === 'method'
      ? 'COST_TRANSPORT_KIND'
      : report.dimension === 'type'
        ? ['expense', 'labor'].includes(report.category || '')
          ? 'REIMBURSEMENT_EXPENSE_TYPE'
          : ['office', 'warehouse', 'premises_unknown'].includes(report.category || '')
            ? 'COST_PREMISES_TYPE'
            : 'MARKETING_EXPENSE_TYPE'
        : undefined
}

export function objectDictionaryCodes(report: CostReport): string[] {
  return report.objects
    .map((group) => objectDictionary(report, group.key))
    .filter((code): code is string => !!code)
}

/** 费用分类字典与录入页共用；稳定分组键保持不变。 */
export function resolveObjectLabels(report: CostReport): CostReport {
  return {
    ...report,
    objects: report.objects.map((group) => {
      if (group.key.startsWith('dict:'))
        return { ...group, label: dictionaryValue(group.key, group.label) }
      const dictionary = objectDictionary(report, group.key)
      if (!dictionary) return group
      const code = group.key.replace(/^code:(?:REIMBURSEMENT_EXPENSE_TYPE:)?/, '')
      const label = costLabel(dictionary, code)
      return label === code ? group : { ...group, label }
    }),
  }
}

/** A zero amount does not establish whether payroll has been recorded. */
export function payrollHasRecords(report: CostReport): boolean {
  return report.categories.some((group) => group.key === 'labor' && group.count > 0)
}

export function comparisonCoverageNotice(report: CostReport): string {
  if (!report.meta.comparisonAvailable) return ''
  const absent = report.categories.filter(
    (group) => Number(group.previous) > 0 && group.count === 0,
  )
  return absent.length
    ? `本期${absent.map((group) => group.label).join('、')}暂无已确认记录；期间差额可能受登记进度影响。`
    : ''
}
