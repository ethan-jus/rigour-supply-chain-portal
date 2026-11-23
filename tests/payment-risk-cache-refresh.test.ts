import { expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import PaymentRiskView from '@/views/supply-chain/bi/PaymentRiskView.vue'
import { getPaymentRisk } from '@/api/core/payment-risk'

vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }))
vi.mock('@/api/core/payment-risk', () => ({ getPaymentRisk: vi.fn() }))

it('默认打开商品账龄，可切换合同到期，手动刷新强制回源', async () => {
  vi.mocked(getPaymentRisk).mockResolvedValue({
    generatedAt: '2026-11-10T00:00:00Z', dataUpdatedAt: null, categories: [], orders: [],
  })
  const wrapper = mount(PaymentRiskView, { global: { plugins: [ElementPlus], stubs: { EchartsChart: true, ReceivablesView: true } } })
  try {
    await flushPromises()
    expect(wrapper.find('.payment-risk-board').exists()).toBe(true)
    expect(getPaymentRisk).toHaveBeenCalledTimes(1)
    expect(getPaymentRisk).toHaveBeenLastCalledWith(expect.any(Object), false)

    await wrapper.findAll('input[type="radio"]')[1]!.setValue(true)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ReceivablesView' }).exists()).toBe(true)
    expect(wrapper.find('.payment-risk-board').exists()).toBe(false)
    expect(getPaymentRisk).toHaveBeenCalledTimes(1)

    await wrapper.findAll('input[type="radio"]')[0]!.setValue(true)
    await flushPromises()
    expect(wrapper.find('.payment-risk-board').exists()).toBe(true)
    expect(getPaymentRisk).toHaveBeenCalledTimes(2)
    expect(getPaymentRisk).toHaveBeenLastCalledWith(expect.any(Object), false)
    await wrapper.get('button[aria-label="刷新数据"]').trigger('click')
    await flushPromises()
    expect(getPaymentRisk).toHaveBeenLastCalledWith(expect.any(Object), true)
  } finally { wrapper.unmount() }
})
