import { costLabel } from '../../cost/cost-dictionaries'
import type { EChartsCoreOption } from 'echarts/core'
import type { CostCategory, CostGroup, CostRecord, CostReport } from '@/api/core/bi-cost-dashboard'
export const categories: Record<CostCategory, string> = {
  warehouse: '仓储费用',
  marketing: '营销费用',
  office: '办公费用',
  freight: '运费',
  labor: '人力薪酬',
  expense: '员工报销',
  premises_unknown: '待分类场地费用',
  purchase: '商品采购',
  loss: '商品损耗',
}
export const dimensions: Record<CostCategory, string[]> = {
  freight: ['leg', 'route', 'carrier', 'method', 'type', 'employee'],
  warehouse: ['premises', 'contract'],
  office: ['premises', 'contract', 'type', 'employee'],
  labor: ['employee', 'department'],
  marketing: ['type', 'channel', 'employee', 'payee'],
  expense: ['type', 'employee', 'department', 'trip', 'destination', 'payee'],
  purchase: ['supplier', 'product', 'warehouse'],
  loss: ['product', 'lossReason', 'warehouse'],
  premises_unknown: ['premises', 'contract'],
}
export const dimensionNames: Record<string, string> = {
  leg: '运输环节',
  carrier: '承运方',
  method: '运输方式',
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
export const statusName = (v: string) =>
  ({
    CONFIRMED: '已确认',
    DRAFT: '待确认',
    VOID: '已作废',
    PAID: '已付款',
    UNPAID: '未付款',
    UNKNOWN: '未记录',
  })[v] || '未记录'
/** 费用归集后的类别不改变原单费用类型的字典。 */
export function detailDimensionValue(
  record: Pick<CostRecord, 'source' | 'category'>,
  name: string,
  value: string,
) {
  const dictionary =
    name === '运输环节'
      ? 'COST_LOGISTICS_LEG'
      : name === '运输方式'
        ? 'COST_TRANSPORT_METHOD'
        : name === '费用类型'
          ? record.source === 'HR' || record.category === 'expense'
            ? 'REIMBURSEMENT_EXPENSE_TYPE'
            : ['office', 'warehouse', 'premises_unknown'].includes(record.category)
              ? 'COST_PREMISES_TYPE'
              : 'MARKETING_EXPENSE_TYPE'
          : undefined
  return dictionary && value !== '未记录' ? costLabel(dictionary, value) : value
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
    min: 0,
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
      data: groups
        .filter((g) => Number(g.current) > 0)
        .map((g, i) => ({
          id: g.key,
          name: g.label,
          value: Number(g.current),
          itemStyle: { color: category ? categoryColor(g.key, i) : palette[i % palette.length] },
        })),
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
export function line(report: CostReport): EChartsCoreOption {
  return {
    ...theme,
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      valueFormatter: (v: unknown) => `${money(String(v))} 元`,
    },
    legend: { top: 0, bottom: 'auto', textStyle: { color: '#9bb0c7' }, selectedMode: false },
    grid: { left: 8, right: 14, top: 42, bottom: 12, containLabel: true },
    xAxis: {
      type: 'category',
      data: report.cumulative.map((p) => p.key),
      boundaryGap: false,
      axisLabel: { color: '#8da4bb' },
    },
    yAxis: amountAxis(
      report.cumulative.flatMap((p) => [
        Number(p.current),
        ...(report.meta.comparisonAvailable ? [Number(p.previous)] : []),
      ]),
    ),
    series: [
      {
        name: '本期',
        type: 'line',
        showSymbol: false,
        data: report.cumulative.map((p) => (p.current == null ? null : Number(p.current))),
        itemStyle: { color: '#7dafff' },
        areaStyle: { opacity: 0.07 },
      },
      ...(report.meta.comparisonAvailable
        ? [
            {
              name: '可比期',
              type: 'line',
              showSymbol: false,
              data: report.cumulative.map((p) => (p.previous == null ? null : Number(p.previous))),
              lineStyle: { type: 'dashed' },
              itemStyle: { color: '#8b9eaf' },
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

/** 费用分类字典与录入页共用；稳定分组键保持不变。 */
export function resolveObjectLabels(report: CostReport): CostReport {
  const dictionary =
    report.dimension === 'leg'
      ? 'COST_LOGISTICS_LEG'
      : report.dimension === 'method'
        ? 'COST_TRANSPORT_METHOD'
        : report.dimension === 'type'
          ? ['expense', 'labor'].includes(report.category || '')
            ? 'REIMBURSEMENT_EXPENSE_TYPE'
            : ['office', 'warehouse', 'premises_unknown'].includes(report.category || '')
              ? 'COST_PREMISES_TYPE'
              : 'MARKETING_EXPENSE_TYPE'
          : undefined
  if (!dictionary) return report
  return {
    ...report,
    objects: report.objects.map((group) =>
      group.key.startsWith('code:REIMBURSEMENT_EXPENSE_TYPE:')
        ? {
            ...group,
            label: costLabel(
              'REIMBURSEMENT_EXPENSE_TYPE',
              group.key.slice('code:REIMBURSEMENT_EXPENSE_TYPE:'.length),
            ),
          }
        : group.key.startsWith('code:')
          ? { ...group, label: costLabel(dictionary, group.key.slice(5)) }
          : group,
    ),
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

export function overviewReading(report: CostReport, comparisonLabel: string): string {
  if (!report.current.count) return '本期暂无计入经营费用的已确认记录。'
  const first = report.categories
    .filter((item) => Number(item.current) > 0)
    .reduce<CostGroup | undefined>(
      (largest, item) =>
        !largest || Number(item.current) > Number(largest.current) ? item : largest,
      undefined,
    )
  const comparison = report.meta.comparisonAvailable
    ? `本期已登记费用${comparisonLabel}${Number(report.delta) >= 0 ? '增加' : '减少'} ${money(report.delta?.replace('-', ''))} 元。`
    : '当前无可比记录。'
  return `${comparison}${first ? `${first.label}占本期 ${percent(first.share)}。` : ''}`
}
