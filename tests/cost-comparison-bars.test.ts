import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CostComparisonBars from '@/views/supply-chain/bi/cost/CostComparisonBars.vue'
import type { CostGroup } from '@/api/core/bi-cost-dashboard'

const group = (
  key: string,
  current: string,
  previous: string | null,
  delta: string | null,
): CostGroup => ({
  key,
  label: key,
  current,
  previous,
  delta,
  growth: null,
  share: null,
  count: 1,
  missing: false,
})

describe('费用金额横向对比', () => {
  it('同一刻度对比两期，直接显示精确金额、增加和减少，并支持费用下钻', async () => {
    const wrapper = mount(CostComparisonBars, {
      props: {
        comparable: true,
        groups: [
          group('仓储费用', '6000.00', '0.00', '6000.00'),
          group('人力薪酬', '0.00', '20630.27', '-20630.27'),
        ],
      },
    })
    const rows = wrapper.findAll('li')
    expect(rows[0]!.text()).toContain('人力薪酬')
    expect(rows[0]!.text()).toContain('减少 20,630.27 元')
    expect(rows[0]!.findAll('strong').map((v) => v.text())).toEqual(['0.00', '20,630.27'])
    expect(rows[0]!.get('.previous .comparison-bar').attributes('style')).toContain('width: 100%')
    expect(rows[0]!.get('.current').attributes('style')).toContain('width: 0%')
    expect(rows[1]!.text()).toContain('增加 6,000.00 元')
    const width = Number(
      rows[1]!
        .get('.current')
        .element.getAttribute('style')!
        .match(/width: ([\d.]+)%/)![1],
    )
    expect(width).toBeCloseTo((6000 / 20630.27) * 100, 5)
    await rows[1]!.get('button').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['仓储费用']])
  })

  it('无历史数据不会显示假零或增减，已有历史的零元正确显示', async () => {
    const wrapper = mount(CostComparisonBars, {
      props: {
        comparable: false,
        groups: [group('办公费用', '6500.01', null, null)],
      },
    })
    expect(wrapper.text()).toContain('暂无可比数据')
    expect(wrapper.find('.previous').exists()).toBe(false)
    expect(wrapper.text()).toContain('6,500.01')
    await wrapper.setProps({ comparable: true })
    expect(wrapper.get('.previous strong').text()).toBe('—')
    await wrapper.setProps({ groups: [group('办公费用', '0.00', '0.00', '0.00')] })
    expect(wrapper.text()).toContain('无变化 0.00 元')
    expect(wrapper.get('.previous strong').text()).toBe('0.00')
    expect(wrapper.html()).not.toMatch(/NaN|Infinity/)
  })

  it('多项展开和筛选后重新计算刻度，不改变输入顺序，并保留负金额方向', async () => {
    const groups = Array.from({ length: 8 }, (_, i) =>
      group(`归属${i}`, String(i + 1), '0', String(i + 1)),
    )
    const wrapper = mount(CostComparisonBars, { props: { groups, comparable: true } })
    expect(wrapper.findAll('li')).toHaveLength(6)
    expect(groups[0]!.key).toBe('归属0')
    await wrapper.get('.comparison-expand').trigger('click')
    expect(wrapper.findAll('li')).toHaveLength(8)
    await wrapper.setProps({ groups: [group('调整费用', '-20.00', '80.00', '-100.00')] })
    expect(wrapper.findAll('li')).toHaveLength(1)
    expect(wrapper.text()).toContain('-20.00')
    expect(wrapper.get('.current').attributes('style')).toContain('left: 0%')
    expect(wrapper.get('.current').attributes('style')).toContain('width: 20%')
    expect(wrapper.get('.previous .comparison-bar').attributes('style')).toContain('left: 20%')
    await wrapper.setProps({ groups: [] })
    expect(wrapper.text()).toContain('当前范围没有已确认费用')
  })
})
