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
