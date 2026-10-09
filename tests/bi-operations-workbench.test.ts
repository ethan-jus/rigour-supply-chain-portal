import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import BiOperationsWorkbench from '@/views/supply-chain/bi/components/BiOperationsWorkbench.vue'
import * as api from '@/api/core/bi-operations'

const permissions = vi.hoisted(() => ({ write: true, read: true }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    hasPermission: (permission: string) =>
      permission.endsWith(':read') ? permissions.read : permissions.write,
  }),
}))
vi.mock('@/api/core/bi', () => ({
  getSupplyDashboardFilterOptions: vi.fn().mockResolvedValue({ regions: [], salesOwners: [] }),
}))
vi.mock('@/api/core/bi-operations', () => ({
  createBiAction: vi.fn(),
  getBiActionEvents: vi.fn(),
  getBiActions: vi.fn(),
  updateBiAction: vi.fn(),
}))
const action: api.BiAction = {
  id: 'a1',
  kind: 'COLLECTION',
  businessRef: 'customer-id:17',
  businessLabel: '客户甲',
  cityCode: 'BJ',
  employeeCode: 'E1',
  assignee: 'E1',
  dueAt: '2026-09-15T00:00:00Z',
  status: 'OPEN',
  note: '约定回款',
  revision: 2,
  createdBy: 'u',
  createdAt: '2026-09-12T00:00:00Z',
  updatedAt: '2026-09-12T00:00:00Z',
}
let wrapper: VueWrapper
beforeEach(() => {
  vi.clearAllMocks()
  permissions.write = true
  permissions.read = true
  vi.mocked(api.getBiActions).mockResolvedValue({
    items: [action],
    total: 1,
    page: 1,
    pageSize: 20,
  })
  vi.mocked(api.getBiActionEvents).mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
async function open(props = {}) {
  wrapper = mount(BiOperationsWorkbench, {
    attachTo: document.body,
    props: {
      regionCode: 'BJ',
      regions: [{ value: 'BJ', label: '北京' }],
      salesOwners: [{ value: 'E1', label: '销售甲' }],
      ...props,
    },
    global: { plugins: [ElementPlus] },
  })
  await flushPromises()
}
async function button(text: string) {
  await wrapper
    .findAll('button')
    .find((button) => button.text() === text)!
    .trigger('click')
  await flushPromises()
}
describe('BI operating workspace', () => {
  it('registers a real seeded customer with assignee and deadline', async () => {
    await open({
      actionSeed: {
        kind: 'CUSTOMER',
        businessRef: 'customer-code:C17',
        businessLabel: '客户甲',
        employeeCode: 'E1',
      },
    })
    const picker = wrapper.findAllComponents({ name: 'ElDatePicker' })[0]!
    picker.vm.$emit('update:modelValue', new Date('2026-09-15T00:00:00Z'))
    await wrapper.get('textarea[aria-label="处理记录"]').setValue('联系确认首单')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.createBiAction).toHaveBeenCalledWith(
      expect.objectContaining({
        businessRef: 'customer-code:C17',
        assignee: 'E1',
        cityCode: 'BJ',
        dueAt: '2026-09-15T00:00:00.000Z',
        note: '联系确认首单',
      }),
    )
    expect(wrapper.emitted('changed')).toEqual([[{ type: 'actions' }]])
  })
  it('loads history and persists explicit progress while preserving revision', async () => {
    await open()
    await button('客户甲')
    expect(api.getBiActionEvents).toHaveBeenCalledWith('a1')
    const status = wrapper
      .findAllComponents({ name: 'ElSelect' })
      .find((c) => c.props('modelValue') === 'OPEN')!
    status.vm.$emit('update:modelValue', 'IN_PROGRESS')
    await wrapper.get('textarea[aria-label="处理记录"]').setValue('已联系，下周再跟进')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateBiAction).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({
        status: 'IN_PROGRESS',
        expectedRevision: 2,
        note: '已联系，下周再跟进',
      }),
    )
  })
  it('is readonly without write grants and does not show internal ids', async () => {
    permissions.write = false
    await open()
    await button('客户甲')
    expect(wrapper.text()).not.toContain('保存处理记录')
    expect(wrapper.text()).toContain('当前账号仅可查看跟进记录')
    expect(wrapper.text()).not.toContain('customer-id:17')
    expect(api.createBiAction).not.toHaveBeenCalled()
  })
  it('does not load data when read permission is missing', async () => {
    permissions.read = false
    await open()
    expect(api.getBiActions).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('没有经营看板读取权限')
  })
})
