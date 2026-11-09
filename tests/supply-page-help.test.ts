import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import SupplyPageHelp from '@/components/supply/SupplyPageHelp.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('页面说明入口', () => {
  it.each(['mouseenter', 'focus'])('通过 %s 展示完整说明，Escape 可关闭', async (event) => {
    wrapper = mount(SupplyPageHelp, {
      attachTo: document.body,
      slots: { default: '可认领的公司门店；停业门店不进入公海。' },
      global: { plugins: [ElementPlus] },
    })
    const button = wrapper.get('button[aria-label="查看页面说明"]')
    expect(button.text()).toBe('')
    expect(button.find('svg').exists()).toBe(true)
    const isOpen = () => {
      const popover = document.querySelector<HTMLElement>('[role="tooltip"]')
      return (
        !!popover &&
        popover.style.display !== 'none' &&
        popover.getAttribute('aria-hidden') !== 'true'
      )
    }
    expect(isOpen()).toBe(false)
    await button.trigger(event)
    await vi.waitFor(() => {
      expect(isOpen()).toBe(true)
      expect(document.querySelector('[role="tooltip"]')?.textContent).toContain(
        '可认领的公司门店；停业门店不进入公海。',
      )
    })
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    )
    await vi.waitFor(() => expect(isOpen()).toBe(false))
  })
})
