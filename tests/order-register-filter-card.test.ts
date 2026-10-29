import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ElementPlus from 'element-plus'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'

function mountCard() {
  return mount(OrderRegisterFilterCard, {
    global: { plugins: [ElementPlus] },
    slots: {
      primary: '<input aria-label="条件一" /><input aria-label="条件二" />',
      actions: '<button type="button">导出</button>',
    },
  })
}

function actionTexts(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.findAll('.order-register-filter__actions button').map((node) => node.text())
}

describe('订单登记筛选卡', () => {
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight')
  })

  it('条件未溢出时不展示展开按钮', async () => {
    const wrapper = mountCard()
    await flushPromises()
    expect(wrapper.find('.order-register-filter__fields').classes()).not.toContain('is-collapsed')
    expect(actionTexts(wrapper)).toEqual(['导出', '查询', '重置'])
    wrapper.unmount()
  })

  it('条件超过一行时默认收起，展开后完整展示', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 100,
    })
    const wrapper = mountCard()
    await flushPromises()

    expect(actionTexts(wrapper)).toContain('展开')
    expect(wrapper.find('.order-register-filter__fields').classes()).toContain('is-collapsed')

    const expand = wrapper
      .findAll('.order-register-filter__actions button')
      .find((node) => node.text().includes('展开'))
    await expand!.trigger('click')
    await flushPromises()

    expect(wrapper.find('.order-register-filter__fields').classes()).not.toContain('is-collapsed')
    expect(actionTexts(wrapper)).toContain('收起')
    wrapper.unmount()
  })
  it('折叠行不接收焦点，展开后恢复所有条件', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 100,
    })
    const originalTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get() {
        return this.getAttribute('aria-label') === '条件二' ? 44 : 0
      },
    })
    const wrapper = mountCard()
    try {
      await flushPromises()
      expect(wrapper.get('[aria-label="条件一"]').attributes('inert')).toBeUndefined()
      expect(wrapper.get('[aria-label="条件二"]').attributes('inert')).toBeDefined()
      await wrapper
        .findAll('button')
        .find((node) => node.text().includes('展开'))!
        .trigger('click')
      await flushPromises()
      expect(wrapper.get('[aria-label="条件二"]').attributes('inert')).toBeUndefined()
    } finally {
      wrapper.unmount()
      if (originalTop) Object.defineProperty(HTMLElement.prototype, 'offsetTop', originalTop)
      else Reflect.deleteProperty(HTMLElement.prototype, 'offsetTop')
    }
  })
})
