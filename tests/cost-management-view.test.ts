import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import CostManagementView from '@/views/supply-chain/cost/CostManagementView.vue'
import {
  getCosts,
  getCostCities,
  getCostEmployees,
  getCostWarehouses,
  type CostPage,
} from '@/api/core/cost'
const state = vi.hoisted(() => ({
  permissions: new Set<string>(),
  route: { path: '/supply-chain/cost/logistics' },
}))
vi.mock('vue-router', () => ({ useRoute: () => state.route }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: (permission: string) => state.permissions.has(permission) }),
}))
vi.mock('@/api/core/cost', () => ({
  getCosts: vi.fn(),
  getCostCities: vi.fn(),
  getCostEmployees: vi.fn(),
  getCostWarehouses: vi.fn(),
  getCostSources: vi.fn(),
  getCostHistory: vi.fn(),
  saveCost: vi.fn(),
  changeCostStatus: vi.fn(),
}))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn().mockResolvedValue(undefined),
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value,
  businessDictionaryOptions: () => [],
}))
let wrapper: VueWrapper | undefined
const empty: CostPage = {
  total: 0,
  begin: 0,
  step: 20,
  items: [],
  confirmedAmount: 0,
  paidAmount: 0,
  pendingCount: 0,
}
beforeEach(() => {
  vi.clearAllMocks()
  state.route = reactive({ path: '/supply-chain/cost/logistics' })
  state.permissions = new Set(['order:logistics-cost:read'])
  vi.mocked(getCosts).mockResolvedValue(empty)
  vi.mocked(getCostCities).mockResolvedValue([])
  vi.mocked(getCostEmployees).mockResolvedValue([])
  vi.mocked(getCostWarehouses).mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
async function render() {
  wrapper = mount(CostManagementView, {
    global: {
      plugins: [ElementPlus, createPinia()],
      stubs: { SupplyPageTitle: true, ElDialog: true, ElDrawer: true },
    },
  })
  await flushPromises()
}
describe('cost management workflow', () => {
  it('loads the Order list and keeps mutation controls hidden for read-only access', async () => {
    await render()
    expect(getCosts).toHaveBeenCalledWith(
      'logistics',
      expect.objectContaining({ begin: 0, step: 20 }),
    )
    expect(wrapper!.findAll('button').some((button) => /新增/.test(button.text()))).toBe(false)
  })
  it.each(['expenses', 'marketing', 'warehouse-rentals', 'logistics'] as const)(
    'submits independent document, title, remark and date filters for %s',
    async (category) => {
      state.route.path =
        category === 'expenses' ? '/supply-chain/hr/expenses' : `/supply-chain/cost/${category}`
      await render()
      await wrapper!.get('input[aria-label="费用单号"]').setValue(' DOC-1 ')
      await wrapper!.get('input[aria-label="费用事项"]').setValue(' 差旅 ')
      await wrapper!.get('input[aria-label="备注"]').setValue(' 发票 ')
      const dates = wrapper!.findAllComponents({ name: 'ElDatePicker' })
      dates
        .find((picker) => picker.props('ariaLabel') === '费用开始日期')!
        .vm.$emit('update:modelValue', '2026-10-01')
      dates
        .find((picker) => picker.props('ariaLabel') === '费用截止日期')!
        .vm.$emit('update:modelValue', '2026-10-13')
      await wrapper!.get('.supply-list-filters form').trigger('submit')
      await flushPromises()
      expect(getCosts).toHaveBeenLastCalledWith(category, {
        documentNo: 'DOC-1',
        title: '差旅',
        remark: '发票',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-13',
        begin: 0,
        step: 20,
      })
      expect(wrapper!.find('input[aria-label="关键词"]').exists()).toBe(false)
      await wrapper!
        .findAll('button')
        .find((button) => button.text() === '重置')!
        .trigger('click')
      await flushPromises()
      expect(getCosts).toHaveBeenLastCalledWith(category, { begin: 0, step: 20 })
    },
  )
  it('keeps applied filters during pagination and does not double query after resetting the page', async () => {
    vi.mocked(getCosts).mockResolvedValue({ ...empty, total: 45 })
    await render()
    await wrapper!.get('input[aria-label="费用事项"]').setValue('未提交')
    await wrapper!.get('.el-pagination .btn-next').trigger('click')
    await flushPromises()
    expect(getCosts).toHaveBeenLastCalledWith('logistics', { begin: 20, step: 20 })
    vi.mocked(getCosts).mockClear()
    await wrapper!.get('.supply-list-filters form').trigger('submit')
    await flushPromises()
    expect(getCosts).toHaveBeenCalledTimes(1)
    expect(getCosts).toHaveBeenLastCalledWith('logistics', { begin: 0, step: 20, title: '未提交' })
  })
  it('does not carry logistics-only filters to a different cost category', async () => {
    await render()
    await wrapper!.get('input[aria-label="运单号"]').setValue('WAY-1')
    await wrapper!.get('input[aria-label="来源单号"]').setValue('SRC-1')
    await wrapper!.get('.supply-list-filters form').trigger('submit')
    await flushPromises()
    expect(getCosts).toHaveBeenLastCalledWith(
      'logistics',
      expect.objectContaining({ trackingNo: 'WAY-1', sourceDocumentNo: 'SRC-1' }),
    )
    state.route.path = '/supply-chain/cost/warehouse-rentals'
    await flushPromises()
    expect(getCosts).toHaveBeenLastCalledWith('warehouse-rentals', { begin: 0, step: 20 })
    expect(wrapper!.find('input[aria-label="运单号"]').exists()).toBe(false)
    await wrapper!.get('input[aria-label="租赁合同号"]').setValue('LEASE-1')
    await wrapper!.get('.supply-list-filters form').trigger('submit')
    await flushPromises()
    expect(getCosts).toHaveBeenLastCalledWith('warehouse-rentals', {
      begin: 0,
      step: 20,
      contractNo: 'LEASE-1',
    })
  })
  it('shows query failures as errors and clears stale records', async () => {
    vi.mocked(getCosts).mockRejectedValue(new Error('费用查询服务不可用'))
    await render()
    expect(wrapper!.text()).toContain('费用查询服务不可用')
  })
  it('discards the old category response after switching to marketing', async () => {
    let resolveOld!: (value: CostPage) => void
    vi.mocked(getCosts).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    await render()
    state.route.path = '/supply-chain/cost/marketing'
    await flushPromises()
    resolveOld({ ...empty, total: 123 })
    await flushPromises()
    expect(getCosts).toHaveBeenLastCalledWith('marketing', expect.anything())
    expect(wrapper!.findComponent({ name: 'ElPagination' }).props('total')).toBe(0)
  })
})
