import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerAttributeAnalyticsDialog from '@/views/supply-chain/bi/components/CustomerAttributeAnalyticsDialog.vue'
import { getCustomerAttributeAnalytics } from '@/api/core/bi-customer-attributes'

vi.mock('@/api/core/bi-customer-attributes', () => ({ getCustomerAttributeAnalytics: vi.fn() }))
const get = vi.mocked(getCustomerAttributeAnalytics)
const stubs = {
  ElDialog: { template: '<div><slot /></div>' },
  ElAlert: { props: ['title'], template: '<div role="alert">{{ title }}</div>' },
  ElEmpty: { props: ['description'], template: '<div>{{ description }}</div>' },
  ElTabs: { template: '<div><slot /></div>' },
  ElTabPane: { template: '<div><slot /></div>' },
  EchartsChart: true,
  ElTable: true,
  ElTableColumn: true,
  ElButton: { template: '<button><slot /></button>' },
}
const create = () =>
  mount(CustomerAttributeAnalyticsDialog, {
    props: { modelValue: false, query: { regionCode: 'BJ' }, scopeLabel: '北京' },
    global: { stubs, directives: { loading: () => {} } },
  })
describe('CRM customer attributes', () => {
  beforeEach(() => vi.clearAllMocks())
  it('does not present an unsynced source as zero customers', async () => {
    get.mockResolvedValue({
      status: 'NOT_READY',
      syncedAt: null,
      from: '',
      to: '',
      sources: [],
      businessCategories: [],
    })
    const wrapper = create()
    expect(get).not.toHaveBeenCalled()
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(wrapper.text()).toContain('客户属性尚未同步')
    expect(wrapper.text()).not.toContain('当前范围暂无客户档案')
    expect(get).toHaveBeenCalledWith({ regionCode: 'BJ' })
    wrapper.unmount()
  })
  it('labels missing business categories and states the independent scope', async () => {
    const missing = {
      name: '未填写',
      missing: true,
      customerCount: 2,
      orderingCustomerCount: null,
      orderCount: null,
      salesAmount: null,
      paidAmount: null,
    }
    get.mockResolvedValue({
      status: 'READY',
      syncedAt: '2026-09-15T00:00:00Z',
      from: '',
      to: '',
      sources: [],
      businessCategories: [missing],
    })
    const wrapper = create()
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(wrapper.text()).toContain('经营类别未填写 2 户')
    expect(wrapper.text()).toContain('客户类型、商品分类及订单来源：全部')
    expect(wrapper.text()).toContain('包含期间零订单客户')
    wrapper.unmount()
  })
  it('shows errors without retaining data from the previous scope', async () => {
    get.mockRejectedValue(new Error('服务不可用'))
    const wrapper = create()
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(wrapper.text()).toContain('服务不可用')
    expect(wrapper.text()).not.toContain('当前范围暂无客户档案')
    wrapper.unmount()
  })
})
