import { afterEach, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Tabs from '@/components/supply/SupplyFilterTabs.vue'

let wrapper: VueWrapper
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
it('身份页签可用方向键和 Home/End 切换，零数量仍显示，选中态和焦点同步', async () => {
  wrapper = mount(Tabs, {
    attachTo: document.body,
    props: {
      modelValue: 'SALES',
      label: '人员身份',
      items: [
        { value: 'SALES', label: '销售人员', count: 0 },
        { value: 'MANAGER', label: '城市总', count: 2 },
      ],
      'onUpdate:modelValue': (value) => {
        void wrapper.setProps({ modelValue: value })
      },
    },
  })
  expect(wrapper.get('[data-value="SALES"]').text()).toContain('0')
  await wrapper.get('[data-value="SALES"]').trigger('keydown', { key: 'ArrowRight' })
  expect(wrapper.get('[data-value="MANAGER"]').attributes('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(wrapper.get('[data-value="MANAGER"]').element)
  await wrapper.get('[data-value="MANAGER"]').trigger('keydown', { key: 'Home' })
  expect(wrapper.get('[data-value="SALES"]').attributes('tabindex')).toBe('0')
  await wrapper.get('[data-value="SALES"]').trigger('keydown', { key: 'End' })
  expect(wrapper.get('[data-value="MANAGER"]').attributes('aria-selected')).toBe('true')
})
