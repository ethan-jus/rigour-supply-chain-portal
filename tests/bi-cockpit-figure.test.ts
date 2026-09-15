import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { heatmap } from '@/views/supply-chain/bi/cockpit-charts'
import CockpitFigure from '@/views/supply-chain/bi/components/CockpitFigure.vue'
import type { Figure } from '@/views/supply-chain/bi/cockpit-model'

const chartStub = {
  name: 'EchartsChart',
  props: ['option', 'height'],
  emits: ['chart-click'],
  template: '<div class="chart-stub" />',
}
const figure: Figure = {
  id: 'comparison',
  title: '销售回款对比',
  span: 12,
  option: {},
  comparison: Array.from({ length: 10 }, (_, i) => ({
    key: `S${i}`,
    name: `销售${i}`,
    salesAmount: 100,
    paidAmount: 20,
    unpaidAmount: 80,
  })),
  rows: Array.from({ length: 10 }, (_, i) => ({ key: `S${i}`, name: `销售${i}`, cells: {} })),
}
const render = (input: Figure) =>
  mount(CockpitFigure, {
    props: { figure: input },
    global: {
      stubs: {
        EchartsChart: chartStub,
        ElIcon: { template: '<span><slot /></span>' },
        ElButton: { template: '<button><slot /></button>' },
        ElInput: {
          props: ['modelValue', 'size'],
          emits: ['update:modelValue'],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
      },
    },
  })

describe('BI驾驶舱回款图交互', () => {
  it('说明按钮传递原始图对象，样例标记与明细下钻互不改写', async () => {
    const input = { ...figure, sample: true }
    const wrapper = render(input)
    await wrapper.get(`[aria-label="${input.title}口径说明"]`).trigger('click')
    expect(wrapper.emitted('explain')?.[0]).toEqual([input])
    expect(wrapper.emitted('inspect')).toBeUndefined()
    expect(input.sample).toBe(true)
    wrapper.unmount()
  })
  it('离屏零宽不清空分页或改变已测量图形尺寸', async () => {
    let resize!: (entries: unknown[]) => void
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: (entries: unknown[]) => void) {
          resize = callback
        }
        observe() {
          resize([{ contentRect: { width: 800 } }])
        }
        disconnect() {}
      },
    )
    try {
      const wrapper = render(figure)
      await wrapper.get(`[aria-label="${figure.title}下一页"]`).trigger('click')
      const page = wrapper.get('.figure-page').text()
      const chart = wrapper.findComponent(chartStub)
      const option = chart.props('option')
      resize([{ contentRect: { width: 0 } }])
      await nextTick()
      expect(wrapper.get('.figure-page').text()).toBe(page)
      expect(chart.props('option')).toBe(option)
      wrapper.unmount()
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('成本维度点击展开费用，费用点击进入明细，切换范围重置且真实分项不标样例', async () => {
    const wrapper = render({
      ...figure,
      comparison: undefined,
      sample: true,
      rows: [
        { key: '货品', name: '货品', groupKey: '货', sample: true, cells: { 金额: '¥100.00' } },
        {
          key: '已入账',
          name: '已入账',
          groupKey: '未分项',
          sample: false,
          cells: { 金额: '¥40.00' },
        },
      ],
      breakdown: [
        { key: '货品', name: '货品', group: '货', values: [100], sample: true },
        { key: '已入账', name: '已入账', group: '未分项', values: [40], sample: false },
      ],
    })
    const chart = wrapper.findComponent(chartStub)
    chart.vm.$emit('chart-click', { data: { rowKey: '货' } })
    await nextTick()
    expect(chart.props('option').series[0].data[0].rowKey).toBe('货品')
    expect(wrapper.emitted('inspect')).toBeUndefined()
    chart.vm.$emit('chart-click', { data: { rowKey: '货品' } })
    expect(wrapper.emitted('inspect')?.[0]?.[1]).toBe('货品')
    await wrapper.findAll('.cost-scope button')[2].trigger('click')
    expect(wrapper.find('.sample-label').exists()).toBe(false)
    await wrapper.get('[title="查看数据明细"]').trigger('click')
    expect(wrapper.emitted('inspect')?.[1]?.[0]).toMatchObject({
      sample: false,
      rows: [{ key: '已入账' }],
    })
    expect((wrapper.emitted('inspect')?.[1]?.[0] as Figure).rows).toHaveLength(1)
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toContain('共1条数据')
    await wrapper.setProps({
      figure: {
        ...figure,
        comparison: undefined,
        breakdown: [{ key: '工资', name: '工资', group: '人', values: [20], sample: true }],
      },
    })
    expect(wrapper.findAll('.cost-scope button')[0].attributes('aria-pressed')).toBe('true')
    expect(chart.props('option').series[0].data[0].rowKey).toBe('人')
    wrapper.unmount()
  })
  it('窄屏目标矩阵保留四项指标名与单元格数值', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private callback: (entries: unknown[]) => void) {}
        observe() {
          this.callback([{ contentRect: { width: 346 } }])
        }
        disconnect() {}
      },
    )
    try {
      const wrapper = render({
        ...figure,
        id: 'targets',
        comparison: undefined,
        option: heatmap(
          [{ key: 'S1', name: '销售甲', values: [120, 30, 40, 50] }],
          ['销售额', '回款额', '建联客户', '合作客户'],
        ),
      })
      await nextTick()
      const option = wrapper.findComponent(chartStub).props('option')
      expect(option.xAxis.axisLabel.interval).toBe(0)
      expect(option.xAxis.axisLabel.formatter('建联客户')).toBe('建联\n客户')
      expect(option.series[0].label.show).toBe(true)
      wrapper.unmount()
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('成本内层查看对应维度，外层查看对应费用分项', () => {
    const wrapper = render({ ...figure, comparison: undefined, height: 320 })
    const chart = wrapper.findComponent(chartStub)
    expect(chart.props('height')).toBe(320)
    chart.vm.$emit('chart-click', { data: { name: '货', children: [{ rowKey: '货品' }] } })
    expect(wrapper.emitted('inspect')?.[0]?.[1]).toBe('货')
    chart.vm.$emit('chart-click', { data: { name: '货品', rowKey: '货品' } })
    expect(wrapper.emitted('inspect')?.[1]?.[1]).toBe('货品')
    wrapper.unmount()
  })
  it('业绩搜索与翻页不重算名次或坐标尺度', async () => {
    const wrapper = render({
      ...figure,
      title: '全国业绩',
      comparison: undefined,
      performance: Array.from({ length: 12 }, (_, i) => ({
        key: `S${i}`,
        name: `销售${i}`,
        currentRegionName: i === 11 ? '金华' : '北京',
        orderRegionNames: i === 11 ? ['上海', '杭州'] : ['北京'],
        rank: i + 1,
        value: 1200 - i * 100,
      })),
    })
    const chart = wrapper.findComponent(chartStub)
    const scale = chart.props('option').yAxis.max
    await wrapper.get('[aria-label="全国业绩下一页"]').trigger('click')
    expect(chart.props('option').series[0].data[0].rowKey).toBe('S8')
    await wrapper.get('input').setValue('上海')
    expect(chart.props('option').xAxis.data).toEqual(['S11'])
    expect(chart.props('option').xAxis.axisLabel.formatter('S11', 0)).toContain('第12名')
    expect(chart.props('option').yAxis.max).toBe(scale)
    await wrapper.get('input').setValue('金华')
    expect(chart.props('option').xAxis.data).toEqual(['S11'])
    await wrapper.get('input').setValue('杭州')
    expect(chart.props('option').xAxis.data).toEqual(['S11'])
    await wrapper.get('input').setValue('不存在')
    expect(wrapper.text()).toContain('没有匹配的销售人员')
    wrapper.unmount()
  })
  it('金额在仪表下直接可见，缺失值不伪装为零，按钮可查看明细', async () => {
    const wrapper = render({
      ...figure,
      comparison: undefined,
      collection: { rate: 25, salesAmount: 10000, paidAmount: 2500, unpaidAmount: 7500 },
    })
    expect(wrapper.text()).toContain('已回款¥2,500')
    expect(wrapper.text()).toContain('待回款¥7,500')
    expect(wrapper.find('.cockpit-figure__empty').exists()).toBe(false)
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toContain('回款率25.0%')
    expect(wrapper.findComponent(chartStub).props('height')).toBeGreaterThanOrEqual(180)
    await wrapper.findAll('.collection-amounts button')[1].trigger('click')
    expect(wrapper.emitted('inspect')?.[0]?.[1]).toBe('unpaid')
    wrapper.unmount()
  })
  it('紧凑侧栏仪表保持足够高度，长百分比不越过内弧，未改变真实值', async () => {
    for (const rate of [55.9, 100, 1250.5, -123.4, null]) {
      const wrapper = render({
        ...figure,
        comparison: undefined,
        height: 205,
        collection: { rate, salesAmount: 100, paidAmount: rate, unpaidAmount: 44.1 },
      })
      const chart = wrapper.findComponent(chartStub)
      const series = chart.props('option').series[0]
      const readout = series.detail.formatter()
      expect(chart.props('height')).toBe(180)
      expect(readout.length * series.detail.fontSize * 0.7).toBeLessThanOrEqual(
        2 * (series.radius - 24),
      )
      expect(series.data[0].actualRate).toBe(rate)
      expect(series.detail.offsetCenter[1]).not.toBe(series.title.offsetCenter[1])
      wrapper.unmount()
    }
  })
  it('图表分页保留全部对象明细，柱子点击携带对象与回款部分', async () => {
    const wrapper = render(figure)
    const chart = wrapper.findComponent(chartStub)
    const scale = chart.props('option').yAxis.max
    expect(chart.props('option').xAxis.data).toHaveLength(8)
    await wrapper.get('[aria-label="销售回款对比下一页"]').trigger('click')
    expect(chart.props('option').xAxis.data).toEqual(['销售8', '销售9'])
    expect(chart.props('option').yAxis.max).toBe(scale)
    chart.vm.$emit('chart-click', { data: { rowKey: 'S8', collectionPart: 'unpaid' } })
    expect(wrapper.emitted('inspect')?.[0]?.slice(1)).toEqual(['S8', 'unpaid'])
    await wrapper.get('[aria-label="销售回款对比明细"]').trigger('click')
    expect((wrapper.emitted('inspect')?.[1]?.[0] as Figure).rows).toHaveLength(10)
    await wrapper.setProps({ figure: { ...figure, comparison: figure.comparison?.slice(0, 2) } })
    expect(chart.props('option').xAxis.data).toEqual(['销售0', '销售1'])
    wrapper.unmount()
  })
})
