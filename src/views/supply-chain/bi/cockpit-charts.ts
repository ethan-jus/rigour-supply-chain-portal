import type { EChartsCoreOption } from 'echarts/core'

export const chartColors = ['#2864e8', '#18a999', '#efa534', '#e26470', '#7b80bb', '#51b9d1']
export interface PlotRow {
  key: string
  name: string
  values: (number | null)[]
  seriesKeys?: string[]
}
export interface PlotSeries {
  name: string
  color?: string
  unit?: string
}
export interface CollectionGaugeData {
  rate: number | null
  salesAmount: number | null
  paidAmount: number | null
  unpaidAmount: number | null
}
export interface CollectionColumn {
  key: string
  name: string
  salesAmount: number
  paidAmount: number
  unpaidAmount: number
}
export interface PerformanceColumn {
  key: string
  name: string
  region: string
  value: number
  rank: number
  previousRank?: number
}

export function performanceColumns(
  rows: PerformanceColumn[],
  scope: PerformanceColumn[],
  metricName: string,
): EChartsCoreOption {
  const max = Math.max(1, ...scope.map((row) => row.value))
  const min = Math.min(0, ...scope.map((row) => row.value))
  return {
    ...base(),
    animation: false,
    legend: { show: false },
    grid: { left: 54, right: 18, top: 30, bottom: 68 },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.key),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dce4ed' } },
      axisLabel: {
        interval: 0,
        width: 80,
        overflow: 'truncate',
        lineHeight: 17,
        formatter: (_: string, i: number) =>
          `第${rows[i].rank}名\n${rows[i].name}\n${rows[i].region}`,
      },
    },
    yAxis: {
      type: 'value',
      name: '元',
      min: min * 1.25,
      max: max * 1.25,
      axisLabel: { formatter: axisNumber },
      splitLine: { lineStyle: { color: '#e9eef4', type: 'dashed' } },
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      renderMode: 'richText',
      formatter: (raw: unknown) => {
        const row = rows[(raw as { dataIndex: number }).dataIndex]
        return row
          ? `第${row.rank}名 ${row.name}\n${row.region}\n${metricName} ${amount(row.value)}${row.previousRank ? `\n前等长期间 第${row.previousRank}名` : ''}`
          : ''
      },
    },
    series: [
      {
        type: 'bar',
        name: metricName,
        barMaxWidth: 42,
        data: rows.map((row) => ({
          value: row.value,
          rowKey: row.key,
          itemStyle: { color: row.rank <= 3 ? chartColors[row.rank - 1] : '#739be8' },
          label: {
            show: true,
            position: row.value < 0 ? 'bottom' : 'top',
            fontSize: 12,
            color: '#23344b',
            formatter: amount(row.value),
          },
        })),
      },
    ],
  }
}

export function numeric(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function amount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.abs(value) >= 10000
    ? `¥${(value / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}万`
    : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
export function exactAmount(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
export function percent(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`
}
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null
}
export function axisNumber(value: number): string {
  return Math.abs(value) >= 10000
    ? `${Number((value / 10000).toFixed(1))}万`
    : String(Number(value.toFixed(1)))
}

const base = () =>
  ({
    color: chartColors,
    animationDuration: 350,
    textStyle: { fontFamily: 'system-ui, sans-serif', fontSize: 12, color: '#637085' },
    tooltip: {
      trigger: 'axis',
      confine: true,
      renderMode: 'richText',
      backgroundColor: '#fff',
      borderColor: '#dce4ed',
      valueFormatter: (value: unknown) =>
        value == null ? '—' : numeric(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 }),
      textStyle: { color: '#203049', fontSize: 12 },
    },
    legend: {
      type: 'scroll',
      top: 0,
      left: 0,
      itemWidth: 10,
      itemHeight: 8,
      textStyle: { color: '#637085', fontSize: 11 },
    },
  }) satisfies EChartsCoreOption

export function bars(
  rows: PlotRow[],
  series: PlotSeries[],
  options: { stacked?: boolean; unit?: string; vertical?: boolean; limit?: number } = {},
): EChartsCoreOption {
  const vertical = Boolean(options.vertical)
  const limit = options.limit ?? 9
  const category = {
    type: 'category',
    data: rows.map((row) => row.name),
    inverse: !vertical,
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { width: vertical ? 70 : 104, overflow: 'truncate', interval: 0, fontSize: 11 },
  }
  const value = {
    type: 'value',
    name: options.unit || '元',
    nameTextStyle: { padding: [0, 0, 0, 8] },
    axisLabel: { formatter: axisNumber },
    splitLine: { lineStyle: { color: '#e9eef4', type: 'dashed' } },
  }
  return {
    ...base(),
    tooltip: {
      ...base().tooltip,
      valueFormatter: (value: unknown) =>
        value == null
          ? '—'
          : options.unit
            ? `${numeric(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${options.unit}`
            : amount(numeric(value)),
    },
    grid: { left: vertical ? 48 : 112, right: rows.length > limit ? 30 : 18, top: 47, bottom: 30 },
    xAxis: vertical ? category : value,
    yAxis: vertical ? value : category,
    dataZoom:
      rows.length > limit
        ? [
            {
              type: 'slider',
              ...(vertical
                ? { xAxisIndex: 0, height: 12, bottom: 0 }
                : { yAxisIndex: 0, width: 10, right: 0, orient: 'vertical' }),
              startValue: 0,
              endValue: limit - 1,
              filterMode: 'filter',
              showDetail: false,
            },
          ]
        : [],
    series: series.map((item, index) => ({
      name: item.name,
      type: 'bar',
      barMaxWidth: vertical ? 24 : 14,
      stack: options.stacked ? 'total' : undefined,
      itemStyle: { color: item.color || chartColors[index % chartColors.length], borderRadius: 1 },
      data: rows.map((row) => ({
        value: row.values[index],
        rowKey: row.seriesKeys?.[index] || row.key,
      })),
      emphasis: { focus: 'series' },
    })),
  }
}

export function lines(rows: PlotRow[], series: PlotSeries[], unit = '元'): EChartsCoreOption {
  return {
    ...base(),
    tooltip: {
      ...base().tooltip,
      valueFormatter: (value: unknown) =>
        value == null
          ? '—'
          : unit === '元'
            ? amount(numeric(value))
            : `${numeric(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${unit}`,
    },
    grid: { left: 50, right: 16, top: 46, bottom: 28 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: rows.map((row) => row.name),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dce4ed' } },
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      name: unit,
      axisLabel: { formatter: axisNumber },
      splitLine: { lineStyle: { color: '#e9eef4', type: 'dashed' } },
    },
    series: series.map((item, index) => ({
      name: item.name,
      type: 'line',
      smooth: false,
      connectNulls: false,
      showSymbol: rows.length < 3,
      symbolSize: 7,
      itemStyle: { color: item.color || chartColors[index % chartColors.length] },
      lineStyle: { width: 2.5 },
      areaStyle: index === 0 ? { opacity: 0.07 } : undefined,
      data: rows.map((row) => ({
        value: row.values[index],
        rowKey: row.seriesKeys?.[index] || row.key,
      })),
    })),
  }
}

export function collectionGauge(data: CollectionGaugeData): EChartsCoreOption {
  return {
    ...base(),
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      confine: true,
      renderMode: 'richText',
      formatter: () =>
        `回款率 ${percent(data.rate)}\n应收 ${amount(data.salesAmount)}\n已回款 ${amount(data.paidAmount)}\n待回款 ${amount(data.unpaidAmount)}`,
    },
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        center: ['50%', '65%'],
        radius: '96%',
        min: 0,
        max: 100,
        pointer: { show: false },
        progress: { show: data.rate != null, width: 14, roundCap: true },
        axisLine: { roundCap: true, lineStyle: { width: 14, color: [[1, '#edf1f5']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        itemStyle: {
          color: data.rate != null && (data.rate > 100 || data.rate < 0) ? '#d9952b' : '#18a999',
        },
        title: { show: true, offsetCenter: [0, '21%'], color: '#68758a', fontSize: 12 },
        detail: {
          show: true,
          offsetCenter: [0, '-12%'],
          fontSize: 42,
          fontWeight: 650,
          color: '#23344b',
          formatter: () => percent(data.rate),
          valueAnimation: false,
        },
        // Only the arc is bounded. The label and tooltip retain the actual percentage.
        data: [
          {
            name: '回款率',
            value: Math.max(0, Math.min(100, data.rate ?? 0)),
            actualRate: data.rate,
            rowKey: 'summary',
          },
        ],
      },
    ],
  }
}

export function collectionColumns(rows: CollectionColumn[], scope = rows): EChartsCoreOption {
  const rates = rows.map((row) => ratio(row.paidAmount, row.salesAmount))
  const high = Math.max(
    1,
    ...scope.map((row) => Math.max(0, row.paidAmount) + Math.max(0, row.unpaidAmount)),
  )
  const low = Math.min(
    0,
    ...scope.map((row) => Math.min(0, row.paidAmount) + Math.min(0, row.unpaidAmount)),
  )
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(high, Math.abs(low))))
  const lowerMagnitude = 10 ** Math.floor(Math.log10(Math.max(1, Math.abs(low))))
  return {
    ...base(),
    animation: false,
    legend: { ...base().legend, selectedMode: false },
    grid: { left: 52, right: 14, top: 58, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      renderMode: 'richText',
      formatter: (raw: unknown) => {
        const items = raw as { dataIndex: number }[]
        const row = rows[items[0]?.dataIndex]
        if (!row) return ''
        const rate = ratio(row.paidAmount, row.salesAmount)
        const excess = row.paidAmount - row.salesAmount
        return `${row.name}\n应收 ${amount(row.salesAmount)}\n已回款 ${amount(row.paidAmount)}\n待回款 ${amount(row.unpaidAmount)}\n回款率 ${percent(rate)}${excess > 0 ? `\n回款超过应收 ${amount(excess)}` : ''}`
      },
    },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.name),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dce4ed' } },
      axisLabel: { interval: 0, width: 62, overflow: 'truncate', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: '元',
      min: Math.floor((low * 1.18) / lowerMagnitude) * lowerMagnitude,
      max: Math.ceil((high * 1.18) / magnitude) * magnitude,
      axisLabel: { formatter: axisNumber },
      splitLine: { lineStyle: { color: '#e9eef4', type: 'dashed' } },
    },
    series: [
      { name: '已回款', field: 'paidAmount', color: chartColors[1] },
      { name: '待回款', field: 'unpaidAmount', color: chartColors[2] },
    ].map((series, index) => ({
      name: series.name,
      type: 'bar',
      stack: 'collection',
      barMaxWidth: 38,
      itemStyle: { color: series.color },
      emphasis: { focus: 'series' },
      data: rows.map((row, rowIndex) => ({
        value: row[series.field as 'paidAmount' | 'unpaidAmount'],
        rowKey: row.key,
        collectionPart: series.field === 'paidAmount' ? 'paid' : 'unpaid',
        // Put one rate label above the positive stack; retain negative and over-collected facts.
        label: {
          show: row.unpaidAmount > 0 ? index === 1 : index === 0,
          position: 'top',
          distance: 7,
          fontSize: 12,
          color: '#23344b',
          formatter: `回款 ${percent(rates[rowIndex])}`,
        },
      })),
    })),
  }
}

export function waterfall(rows: PlotRow[]): EChartsCoreOption {
  let running = 0
  const offsets: number[] = []
  const magnitudes: number[] = []
  rows.forEach((row, index) => {
    const value = numeric(row.values[0])
    const end = index === rows.length - 1 ? value : running + value
    const start = index === rows.length - 1 ? 0 : running
    offsets.push(Math.min(start, end))
    magnitudes.push(Math.abs(end - start))
    running = end
  })
  return {
    ...base(),
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      confine: true,
      renderMode: 'richText',
      formatter: (raw: unknown) => {
        const p = raw as { dataIndex: number }
        const row = rows[p.dataIndex]
        return row ? `${row.name}\n${amount(numeric(row.values[0]))}` : ''
      },
    },
    grid: { left: 52, right: 16, top: 27, bottom: 34 },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.name),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dce4ed' } },
      axisLabel: { interval: 0, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: '元',
      axisLabel: { formatter: axisNumber },
      splitLine: { lineStyle: { color: '#e9eef4', type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        stack: 'bridge',
        stackStrategy: 'all',
        silent: true,
        itemStyle: { color: 'transparent' },
        emphasis: { itemStyle: { color: 'transparent' } },
        data: offsets,
      },
      {
        type: 'bar',
        stack: 'bridge',
        stackStrategy: 'all',
        barMaxWidth: 42,
        label: {
          show: true,
          position: 'top',
          fontSize: 11,
          formatter: (raw: unknown) =>
            amount(numeric(rows[(raw as { dataIndex: number }).dataIndex]?.values[0])),
        },
        data: magnitudes.map((value, rowIndex) => ({
          value,
          rowKey: rows[rowIndex].key,
          itemStyle: {
            color:
              rowIndex === 0
                ? '#2864e8'
                : numeric(rows[rowIndex].values[0]) < 0
                  ? '#efa534'
                  : '#18a999',
          },
        })),
      },
    ],
  }
}

export function scatter(
  rows: PlotRow[],
  xName: string,
  yName: string,
  xMoney = true,
): EChartsCoreOption {
  return {
    ...base(),
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      confine: true,
      renderMode: 'richText',
      formatter: (raw: unknown) => {
        const data = (raw as { data: { name: string; value: number[] } }).data
        return `${data.name}\n${xName} ${xMoney ? amount(data.value[0]) : axisNumber(data.value[0])}\n${yName} ${axisNumber(data.value[1])}`
      },
    },
    grid: { left: 60, right: 30, top: 38, bottom: 40 },
    xAxis: {
      type: 'value',
      name: xName,
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: { formatter: axisNumber },
      splitLine: { lineStyle: { color: '#edf1f5', type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: yName,
      axisLabel: { formatter: axisNumber },
      splitLine: { lineStyle: { color: '#edf1f5', type: 'dashed' } },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: 14,
        data: rows.map((row) => ({
          name: row.name,
          value: row.values,
          rowKey: row.key,
          itemStyle: { color: numeric(row.values[1]) < 50 ? '#efa534' : '#18a999', opacity: 0.8 },
        })),
        emphasis: { label: { show: true, formatter: '{b}', position: 'top' } },
      },
    ],
  }
}

export function ring(rows: PlotRow[], center: string, caption: string): EChartsCoreOption {
  return {
    ...base(),
    tooltip: { trigger: 'item', confine: true, renderMode: 'richText' },
    legend: { bottom: 0, left: 'center', itemWidth: 10, itemHeight: 8 },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '38%',
        style: { text: center, fill: '#203049', fontSize: 30, fontWeight: 650 },
      },
      {
        type: 'text',
        left: 'center',
        top: '54%',
        style: { text: caption, fill: '#68758a', fontSize: 12 },
      },
    ],
    series: [
      {
        type: 'pie',
        radius: ['63%', '77%'],
        center: ['50%', '44%'],
        label: { show: false },
        data: rows.map((row, i) => ({
          name: row.name,
          value: row.values[0],
          rowKey: row.key,
          itemStyle: { color: chartColors[i % chartColors.length] },
        })),
      },
    ],
  }
}

export function heatmap(
  rows: PlotRow[],
  columns: string[],
  options?: {
    money?: boolean
    unit?: string
    reverse?: boolean
    missingLabel?: string
    cellKey?: (row: PlotRow, x: number) => string
  },
): EChartsCoreOption {
  const maximum =
    options?.money || options?.unit
      ? Math.max(1, ...rows.flatMap((row) => row.values.map((v) => v ?? 0)))
      : 120
  const minimum =
    options?.money || options?.unit
      ? Math.min(0, ...rows.flatMap((row) => row.values.map((v) => v ?? 0)))
      : 0
  const format = options?.money
    ? amount
    : options?.unit
      ? (value: number) => `${axisNumber(value)}${options.unit}`
      : percent
  return {
    ...base(),
    legend: { show: false },
    grid: { left: 108, right: rows.length > 8 ? 28 : 14, top: 10, bottom: 58 },
    dataZoom:
      rows.length > 8
        ? [
            {
              type: 'slider',
              yAxisIndex: 0,
              orient: 'vertical',
              right: 0,
              width: 10,
              startValue: 0,
              endValue: 7,
              filterMode: 'filter',
              showDetail: false,
            },
          ]
        : [],
    xAxis: {
      type: 'category',
      data: columns,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((row) => row.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { width: 96, overflow: 'truncate', interval: 0 },
    },
    visualMap: [
      {
        seriesIndex: 0,
        min: minimum,
        max: maximum,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemHeight: 120,
        itemWidth: 9,
        text: [format(maximum), format(minimum)],
        inRange: {
          color: options?.reverse
            ? ['#f1b66b', '#fbefd8', '#b5ded8', '#168b82']
            : ['#eef3fb', '#b8cffa', '#6592df', '#2864e8'],
        },
      },
      {
        show: false,
        seriesIndex: 1,
        min: 0,
        max: 1,
        inRange: { color: ['#f2f4f7', '#f2f4f7'] },
      },
    ],
    tooltip: {
      trigger: 'item',
      confine: true,
      renderMode: 'richText',
      formatter: (raw: unknown) => {
        const data = (raw as { data: { value: number[]; missing?: boolean } }).data
        const p = data.value
        if (data.missing)
          return `${rows[p[1]]?.name}\n${columns[p[0]]} ${options?.missingLabel || '暂无数据'}`
        return `${rows[p[1]]?.name}\n${columns[p[0]]} ${format(p[2])}`
      },
    },
    series: [
      {
        type: 'heatmap',
        data: rows.flatMap((row, y) =>
          row.values.flatMap((value, x) =>
            value == null
              ? []
              : [{ value: [x, y, value], rowKey: options?.cellKey?.(row, x) || row.key }],
          ),
        ),
        label: {
          show: true,
          formatter: (raw: unknown) => format((raw as { value: number[] }).value[2]),
          fontSize: 11,
        },
        itemStyle: { borderColor: '#fff', borderWidth: 3 },
      },
      {
        type: 'heatmap',
        data: rows.flatMap((row, y) =>
          row.values.flatMap((value, x) =>
            value == null
              ? [
                  {
                    value: [x, y, 0],
                    rawValue: null,
                    missing: true,
                    rowKey: options?.cellKey?.(row, x) || row.key,
                  },
                ]
              : [],
          ),
        ),
        itemStyle: { color: '#f2f4f7', borderColor: '#fff', borderWidth: 3 },
        label: {
          show: true,
          color: '#68758a',
          formatter: options?.missingLabel || '—',
          fontSize: 11,
        },
      },
    ],
  }
}

export interface CompositionRow extends PlotRow {
  group?: string
  groupName?: string
}

export function costSunburst(
  rows: CompositionRow[],
  metric = '金额',
  unit = '元',
): EChartsCoreOption {
  // Area cannot represent signed adjustments. Keep the signed values on a zero-based axis.
  if (rows.some((row) => numeric(row.values[0]) < 0))
    return bars(rows, [{ name: metric }], { unit, vertical: true })
  const total = rows.reduce((sum, row) => sum + numeric(row.values[0]), 0)
  const format = (value: number) => (unit === '元' ? amount(value) : `${axisNumber(value)}${unit}`)
  const groups = new Map<string, { name: string; value: number; children: object[] }>()
  const nodes: object[] = []
  for (const row of rows) {
    const node = { name: row.name, value: numeric(row.values[0]), rowKey: row.key }
    if (row.group) {
      const group = groups.get(row.group) || {
        name: row.groupName || row.group,
        value: 0,
        children: [],
      }
      group.value += node.value
      group.children.push(node)
      groups.set(row.group, group)
    } else nodes.push(node)
  }
  nodes.push(...groups.values())
  return {
    ...base(),
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      confine: true,
      renderMode: 'richText',
      formatter: (raw: unknown) => {
        const row = (raw as { data: { name: string; value: number } }).data
        return `${row.name}\n${metric} ${format(row.value)}\n占当前范围 ${percent(ratio(row.value, total))}`
      },
    },
    graphic:
      total === 0
        ? [
            {
              type: 'text',
              left: 'center',
              top: '40%',
              style: { text: `${metric}合计 ${format(0)}`, fill: '#637085', fontSize: 18 },
            },
          ]
        : [],
    series: [
      {
        name: metric,
        type: 'sunburst',
        center: ['50%', '50%'],
        radius: ['14%', '88%'],
        nodeClick: false,
        stillShowZeroSum: false,
        sort: 'desc',
        color: ['#3675bb', '#278f86', '#af7540', '#78739b', '#61859b'],
        label: {
          show: true,
          rotate: 'tangential',
          minAngle: 18,
          fontSize: 12,
          overflow: 'truncate',
          formatter: '{b}',
        },
        emphasis: { focus: 'ancestor' },
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        levels: [
          {},
          {
            radius: ['14%', '52%'],
            label: {
              rotate: 0,
              minAngle: 10,
              fontSize: 12,
              formatter: (raw: unknown) => {
                const row = (raw as { data: { name: string; value: number } }).data
                return `${row.name}\n${format(row.value)}`
              },
            },
          },
          { radius: ['55%', '88%'] },
        ],
        data: nodes,
      },
    ],
  }
}

export function pareto(rows: PlotRow[], metric = '金额', unit = '元'): EChartsCoreOption {
  const sorted = [...rows].sort((a, b) => numeric(b.values[0]) - numeric(a.values[0]))
  if (sorted.some((row) => numeric(row.values[0]) < 0))
    return bars(sorted, [{ name: metric }], { unit, vertical: true, limit: 6 })
  const total = sorted.reduce((sum, row) => sum + numeric(row.values[0]), 0)
  let cumulative = 0
  const cumulativeData = sorted.map((row) => {
    cumulative += numeric(row.values[0])
    return { value: ratio(cumulative, total), rowKey: row.key }
  })
  return {
    ...base(),
    grid: { left: 52, right: 42, top: 46, bottom: 60 },
    xAxis: {
      type: 'category',
      data: sorted.map((row) => row.name),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dce4ed' } },
      axisLabel: { width: 54, overflow: 'truncate', interval: 0, fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: unit,
        axisLabel: { formatter: axisNumber },
        splitLine: { lineStyle: { color: '#e9eef4', type: 'dashed' } },
      },
      {
        type: 'value',
        name: '累计贡献',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%' },
        splitLine: { show: false },
      },
    ],
    dataZoom:
      sorted.length > 6
        ? [
            {
              type: 'slider',
              xAxisIndex: 0,
              height: 12,
              bottom: 0,
              startValue: 0,
              endValue: 5,
              filterMode: 'filter',
              showDetail: false,
            },
          ]
        : [],
    tooltip: {
      trigger: 'item',
      confine: true,
      renderMode: 'richText',
      formatter: (raw: unknown) => {
        const p = raw as { data: { rowKey: string } }
        const index = sorted.findIndex((row) => row.key === p.data.rowKey)
        const row = sorted[index]
        if (!row) return ''
        const value = numeric(row.values[0])
        return `${row.name}\n${metric} ${unit === '元' ? amount(value) : `${axisNumber(value)}${unit}`}\n累计贡献 ${percent(cumulativeData[index].value)}`
      },
    },
    series: [
      {
        name: metric,
        type: 'bar',
        barMaxWidth: 30,
        itemStyle: { color: chartColors[0] },
        data: sorted.map((row) => ({ value: row.values[0], rowKey: row.key })),
      },
      {
        name: '累计贡献',
        type: 'line',
        yAxisIndex: 1,
        smooth: false,
        connectNulls: false,
        symbolSize: 6,
        lineStyle: { width: 2 },
        itemStyle: { color: chartColors[1] },
        data: cumulativeData,
      },
    ],
  }
}
