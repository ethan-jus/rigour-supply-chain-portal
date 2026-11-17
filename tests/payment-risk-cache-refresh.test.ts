import { expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import PaymentRiskView from '@/views/supply-chain/bi/PaymentRiskView.vue'
import { getPaymentRisk } from '@/api/core/payment-risk'

vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }))
vi.mock('@/api/core/payment-risk', () => ({ getPaymentRisk: vi.fn() }))

it('首次进入复用缓存，点击回款风险刷新按钮强制回源', async () => {
  vi.mocked(getPaymentRisk).mockResolvedValue({
    generatedAt: '2026-11-10T00:00:00Z', dataUpdatedAt: null, categories: [], orders: [],
  })
  const wrapper = mount(PaymentRiskView, { global: { plugins: [ElementPlus], stubs: { EchartsChart: true } } })
  try {
    await flushPromises()
    expect(getPaymentRisk).toHaveBeenLastCalledWith(expect.any(Object), false)
    await wrapper.get('button[aria-label="刷新数据"]').trigger('click')
    await flushPromises()
    expect(getPaymentRisk).toHaveBeenLastCalledWith(expect.any(Object), true)
  } finally { wrapper.unmount() }
})
