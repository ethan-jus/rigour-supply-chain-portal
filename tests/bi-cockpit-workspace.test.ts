import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CockpitWorkspace from '@/views/supply-chain/bi/components/CockpitWorkspace.vue'
import type { Figure, CockpitAction } from '@/views/supply-chain/bi/cockpit-model'

const figure = (id: string): Figure => ({ id, title: id, rows: [], option: {}, span: 12 })
const action: CockpitAction = {
  label: '客户回款跟进',
  value: '¥2.00万',
  context: '武汉 · 王华',
  section: 'payment-risk',
  row: {
    key: 'customer-1',
    name: '客户',
    kind: 'customer',
    ownerStaffCode: 'E1',
    regionCode: 'WH',
    cells: {},
  },
}
const render = (aside = [figure('gauge'), figure('target')], actions = [action]) =>
  mount(CockpitWorkspace, {
    props: { main: [figure('trend'), figure('cost')], aside, actions },
    global: {
      stubs: {
        CockpitFigure: {
          name: 'CockpitFigure',
          props: ['figure'],
          template: '<figure>{{figure.id}}<slot name="tools"/><slot name="summary"/></figure>',
        },
        ElIcon: true,
      },
    },
  })
describe('运营主分析与监控编排', () => {
  it('主区保留趋势和成本，跟进位于首个监控图之后，不被目标空态挤到页末', async () => {
    const wrapper = render()
    expect(wrapper.get('.operating-workspace__analysis').text()).toBe('trendcost')
    const monitor = wrapper.get('.operating-workspace__monitor')
    expect(monitor.text().indexOf('优先跟进')).toBeLessThan(monitor.text().indexOf('target'))
    await wrapper.get('.operating-followups button').trigger('click')
    expect(wrapper.emitted('action')?.[0]).toEqual([action])
    wrapper
      .findComponent({ name: 'CockpitFigure' })
      .vm.$emit('inspect', figure('trend'), '2026-09', 'unpaid')
    expect(wrapper.emitted('inspect')?.[0]).toEqual([figure('trend'), '2026-09', 'unpaid'])
    wrapper.unmount()
  })
  it('没有监控数据和真实行动时，不保留空侧栏占位', () => {
    const wrapper = render([], [])
    expect(wrapper.classes()).toContain('operating-workspace--wide')
    expect(wrapper.find('aside').exists()).toBe(false)
    wrapper.unmount()
  })
  it('主图及侧栏各图均透传原始口径说明对象', () => {
    const wrapper = render()
    for (const component of wrapper.findAllComponents({ name: 'CockpitFigure' })) {
      const payload = component.props('figure')
      component.vm.$emit('explain', payload)
      expect(wrapper.emitted('explain')?.at(-1)).toEqual([payload])
    }
    expect(wrapper.emitted('inspect')).toBeUndefined()
    wrapper.unmount()
  })
})
