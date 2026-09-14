import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { cityProductReport, reportRow } from './fixtures/city-product-report'
vi.mock('@/views/supply-chain/bi/components/EchartsChart.vue', () => ({
  default: { name: 'EchartsChart', props: ['option'], template: '<div />' },
}))
import CityProductInvestigation from '@/views/supply-chain/bi/components/CityProductInvestigation.vue'

const stubs = {
  ElRadioGroup: {
    name: 'ElRadioGroup',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div><slot /></div>',
  },
  ElRadioButton: true,
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div><slot /></div>',
  },
  ElOption: true,
  ElButton: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
  ElPagination: {
    name: 'ElPagination',
    props: ['currentPage', 'total'],
    emits: ['update:currentPage'],
    template: '<div />',
  },
  ElEmpty: { props: ['description'], template: '<p>{{ description }}</p>' },
}
describe('city product investigation charts', () => {
  it('offers the remaining products beyond the first 20 with a keyboard-accessible drill action', async () => {
    const rows = Array.from({ length: 21 }, (_, index) =>
      reportRow({ productId: `p${index}`, skuId: `s${index}` }),
    )
    const wrapper = mount(CityProductInvestigation, {
      props: { report: cityProductReport({ rows }), query: {} },
      global: { stubs },
    })
    const pager = wrapper.findComponent({ name: 'ElPagination' })
    expect(pager.props('total')).toBe(21)
    pager.vm.$emit('update:currentPage', 2)
    await nextTick()
    wrapper.findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 0)
    await nextTick()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('select-product')?.[0]?.[0]).toMatchObject({
      productId: 'p20',
      skuId: 's20',
      regionCode: 'WH',
    })
    wrapper.unmount()
  })
  it('visualizes quantities only in the selected raw unit, preserving monthly gaps', async () => {
    const box = reportRow({ quantity: '2.5' })
    const bucket = reportRow({ unitCode: 'BUCKET', quantity: '100' })
    const report = cityProductReport({
      from: '2026-07-01T00:00:00+08:00',
      rows: [box, bucket],
      monthlyRows: [
        { month: '2026-07', metrics: box },
        { month: '2026-07', metrics: bucket },
        { month: '2026-09', metrics: box },
      ],
    })
    const wrapper = mount(CityProductInvestigation, {
      props: { report, query: {} },
      global: { stubs },
    })
    wrapper.findComponent({ name: 'ElRadioGroup' }).vm.$emit('update:modelValue', 'quantity')
    await nextTick()
    let chart = wrapper.findComponent({ name: 'EchartsChart' })
    expect(chart.props('option').series[0].data).toEqual([2.5, null, 2.5])
    wrapper.findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'BUCKET')
    await nextTick()
    chart = wrapper.findComponent({ name: 'EchartsChart' })
    expect(chart.props('option').series[0].data).toEqual([100, null, null])
    expect(chart.props('option').series[0].connectNulls).toBe(false)
    wrapper.unmount()
  })
  it('does not render a redundant single-cell heatmap or invent missing monthly facts', () => {
    const wrapper = mount(CityProductInvestigation, {
      props: { report: cityProductReport(), query: {} },
      global: { stubs },
    })
    expect(wrapper.findAllComponents({ name: 'EchartsChart' })).toHaveLength(0)
    expect(wrapper.text()).toContain('接口尚未提供月度商品明细')
    wrapper.unmount()
  })
})
