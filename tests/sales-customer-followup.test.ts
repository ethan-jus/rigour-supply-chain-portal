import { flushPromises, shallowMount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import SalesCustomerTasks from '@/views/supply-chain/sales/SalesCustomerTasks.vue'

const api = vi.hoisted(() => ({
  evidence: vi.fn(),
  commitments: vi.fn(),
  filterOptions: vi.fn(),
  actions: vi.fn(),
  order: vi.fn(),
}))

vi.mock('@/api/core/sales-customer-followups', () => ({
  getStoreFollowupEvidence: api.evidence,
  getRestockCommitments: api.commitments,
}))
vi.mock('@/api/core/bi', () => ({ getSupplyDashboardFilterOptions: api.filterOptions }))
vi.mock('@/api/core/bi-operations', () => ({ getBiActions: api.actions }))
vi.mock('@/api/core/order-sales', () => ({ getSalesOrder: api.order }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => true }) }))
vi.mock('@/stores/navigation', () => ({
  useNavigationStore: () => ({ hasPath: () => true, getNavigation: () => [] }),
}))
vi.mock('vue-router', async (actual) => ({
  ...(await actual<typeof import('vue-router')>()),
  useRoute: () => ({ query: { month: '2026-09', ownerStaffCode: 'E1' } }),
}))

const selectStub = {
  name: 'ElSelect',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<div><slot /></div>',
}
const workbenchStub = {
  name: 'BiOperationsWorkbench',
  props: ['actionToOpen', 'ownerStaffCode'],
  template: '<div data-tasks />',
}

it('以设计的两个视图呈现门店证据和真实任务，范围、去重及核对状态一致', async () => {
  const store = {
    ownerCode: 'E1',
    city: '杭州',
    ownerName: null,
    lastVisitAt: '2026-09-10T04:00:00Z',
  }
  api.evidence
    .mockResolvedValueOnce({
      items: [
        { ...store, storeId: '11', name: '门店甲', reason: 'VISITED_NO_ORDER', lastOrderAt: null },
        {
          ...store,
          storeId: '12',
          name: '门店乙',
          reason: 'REORDER',
          orderId: '971',
          lastOrderAt: '2026-07-10T04:00:00Z',
        },
      ],
      nextCursor: '12',
    })
    .mockResolvedValueOnce({
      items: [
        { ...store, storeId: '13', name: '门店丙', reason: 'VERIFICATION', lastOrderAt: null },
      ],
      nextCursor: null,
    })
  api.commitments.mockResolvedValue([
    {
      id: 'C1',
      storeId: '11',
      store: '门店甲',
      employee: 'E1',
      city: '杭州',
      due: '2026-09-23',
      visitDate: '2026-09-10',
      visitId: 'V1',
      profileId: 'P1',
    },
  ])
  api.filterOptions.mockResolvedValue({
    salesOwners: [{ optionValue: 'E1', optionLabel: '销售甲' }],
    regions: [],
  })
  const task = { id: 'TK1', status: 'IN_PROGRESS', businessRef: 'customer-id:84' }
  api.actions.mockImplementation(async (params: { businessRef?: string; status: string }) =>
    params.businessRef
      ? { total: 1, items: params.status === 'IN_PROGRESS' ? [task] : [] }
      : { total: params.status === 'IN_PROGRESS' ? 1 : 2, items: [] },
  )
  api.order.mockResolvedValue({ orderNo: 'S-971', customerId: '84' })
  const page = shallowMount(SalesCustomerTasks, {
    global: {
      stubs: {
        ElDatePicker: true,
        ElSelect: selectStub,
        ElOption: true,
        ElDrawer: { props: ['modelValue'], template: '<div><slot v-if="modelValue" /></div>' },
        ElIcon: true,
        RouterLink: { props: ['to'], template: '<a><slot /></a>' },
        BiOperationsWorkbench: workbenchStub,
      },
    },
  })
  try {
    await flushPromises()
    expect(api.evidence).toHaveBeenLastCalledWith(
      expect.objectContaining({
        view: 'TEAM',
        from: '2026-09-01',
        through: '2026-09-30',
        ownerCode: 'E1',
        cursor: '12',
      }),
      expect.anything(),
    )
    expect(api.commitments).toHaveBeenCalledWith(
      expect.objectContaining({ ownerCode: 'E1', from: '2026-09-01', through: '2026-09-30' }),
      expect.anything(),
    )
    expect(page.findAll('.followup-metrics dd').map((item) => item.text())).toEqual([
      '2家',
      '3项',
      '1家',
    ])
    expect(page.findAll('tbody tr')).toHaveLength(4)
    expect(page.text()).not.toContain('9999')
    expect(page.text()).toContain('上次下单 07-10')
    const evidence = page.findAllComponents(selectStub)[1]!
    evidence.vm.$emit('update:modelValue', 'VERIFICATION')
    await flushPromises()
    expect(page.findAll('tbody tr')).toHaveLength(1)
    expect(page.get('tbody tr').text()).toContain('核对关联')
    evidence.vm.$emit('update:modelValue', 'REORDER')
    await flushPromises()
    await page.get('tbody button').trigger('click')
    await flushPromises()
    expect(api.order).toHaveBeenCalledWith('971')
    await page.get('.followup-detail-actions button').trigger('click')
    await flushPromises()
    const workbench = page.getComponent(workbenchStub)
    expect(workbench.props('ownerStaffCode')).toBe('E1')
    expect(workbench.props('actionToOpen')).toEqual(task)
  } finally {
    page.unmount()
  }
})
