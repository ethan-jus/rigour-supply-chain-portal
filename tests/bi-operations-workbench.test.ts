import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import BiOperationsWorkbench from '@/views/supply-chain/bi/components/BiOperationsWorkbench.vue'
import * as api from '@/api/core/bi-operations'

const permissions = vi.hoisted(() => ({ write: true, read: true }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({
  hasPermission: (permission: string) => permission.endsWith(':read') ? permissions.read : permissions.write,
}) }))
vi.mock('@/api/core/bi', () => ({ getSupplyDashboardFilterOptions: vi.fn().mockResolvedValue({ regions: [], salesOwners: [] }) }))
vi.mock('@/api/core/bi-operations', () => ({
  createBiAction: vi.fn(), deleteBiTarget: vi.fn(), getBiActionEvents: vi.fn(),
  getBiActions: vi.fn(), getBiTargets: vi.fn(), saveBiTarget: vi.fn(), updateBiAction: vi.fn(),
}))
const target: api.BiTarget = {
  id: '9', month: '2026-09', dimensionType: 'CITY', dimensionCode: 'BJ', dimensionName: '北京',
  metricCode: 'SALES_AMOUNT', targetValue: '100.00', remark: '月度计划', revision: 3, updatedAt: '2026-09-12T00:00:00Z',
}
const action: api.BiAction = {
  id: 'a1', kind: 'COLLECTION', businessRef: 'customer-id:17', businessLabel: '客户甲',
  cityCode: 'BJ', employeeCode: 'E1', assignee: 'E1', dueAt: '2026-09-15T00:00:00Z',
  status: 'OPEN', note: '约定回款', revision: 2, createdBy: 'u', createdAt: '2026-09-12T00:00:00Z', updatedAt: '2026-09-12T00:00:00Z',
}
let wrapper: VueWrapper
beforeEach(() => {
  vi.clearAllMocks()
  permissions.write = true
  permissions.read = true
  vi.mocked(api.getBiTargets).mockResolvedValue([target])
  vi.mocked(api.getBiActions).mockResolvedValue({ items: [action], total: 1, page: 1, pageSize: 20 })
  vi.mocked(api.getBiActionEvents).mockResolvedValue([])
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
async function open(props = {}) {
  wrapper = mount(BiOperationsWorkbench, {
    attachTo: document.body,
    props: { month: '2026-09', regionCode: 'BJ', regions: [{ value: 'BJ', label: '北京' }],
      salesOwners: [{ value: 'E1', label: '销售甲' }], ...props },
    global: { plugins: [ElementPlus] },
  })
  await flushPromises()
}
async function button(text: string) {
  await wrapper.findAll('button').find(button => button.text() === text)!.trigger('click')
  await flushPromises()
}
describe('BI operating workspace', () => {
  it('loads saved targets and saves an edit with server revision then emits refresh', async () => {
    await open({ initialTab: 'targets' })
    expect(api.getBiTargets).toHaveBeenCalledWith({ month: '2026-09', dimensionType: 'CITY', dimensionCode: 'BJ' })
    await wrapper.get('button[aria-label="编辑目标"]').trigger('click')
    await wrapper.get('input[aria-label="目标值"]').setValue('150.25')
    await wrapper.get('form[aria-label="编辑经营目标"]').trigger('submit')
    await flushPromises()
    expect(api.saveBiTarget).toHaveBeenCalledWith(expect.objectContaining({ targetValue: '150.25', expectedRevision: 3, dimensionCode: 'BJ' }))
    expect(wrapper.emitted('changed')).toEqual([[{ type: 'targets' }]])
  })
  it('retains failed editing input on revision conflict and emits no false completion', async () => {
    vi.mocked(api.saveBiTarget).mockRejectedValueOnce(new Error('数据已被其他人修改，请刷新'))
    await open({ initialTab: 'targets' })
    await wrapper.get('button[aria-label="编辑目标"]').trigger('click')
    await wrapper.get('input[aria-label="目标值"]').setValue('200')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('数据已被其他人修改')
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.emitted('changed')).toBeUndefined()
  })
  it('validates before requesting and never invents target amounts', async () => {
    await open({ initialTab: 'targets' })
    await button('新增目标')
    await wrapper.get('input[aria-label="目标值"]').setValue('-1')
    await wrapper.get('form').trigger('submit')
    expect(api.saveBiTarget).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('非负数')
  })
  it('registers a real seeded customer with assignee and deadline', async () => {
    await open({ actionSeed: { kind: 'CUSTOMER', businessRef: 'customer-code:C17', businessLabel: '客户甲', employeeCode: 'E1' } })
    const picker = wrapper.findAllComponents({ name: 'ElDatePicker' })[0]!
    picker.vm.$emit('update:modelValue', new Date('2026-09-15T00:00:00Z'))
    await wrapper.get('textarea[aria-label="处理记录"]').setValue('联系确认首单')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.createBiAction).toHaveBeenCalledWith(expect.objectContaining({ businessRef: 'customer-code:C17', assignee: 'E1', cityCode: 'BJ', dueAt: '2026-09-15T00:00:00.000Z', note: '联系确认首单' }))
    expect(wrapper.emitted('changed')).toEqual([[{ type: 'actions' }]])
  })
  it('loads history and persists explicit progress while preserving revision', async () => {
    await open()
    await button('客户甲')
    expect(api.getBiActionEvents).toHaveBeenCalledWith('a1')
    const status = wrapper.findAllComponents({ name: 'ElSelect' }).find(c => c.props('modelValue') === 'OPEN')!
    status.vm.$emit('update:modelValue', 'IN_PROGRESS')
    await wrapper.get('textarea[aria-label="处理记录"]').setValue('已联系，下周再跟进')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateBiAction).toHaveBeenCalledWith('a1', expect.objectContaining({ status: 'IN_PROGRESS', expectedRevision: 2, note: '已联系，下周再跟进' }))
  })
  it('is readonly without write grants and does not show internal ids', async () => {
    permissions.write = false
    await open({ initialTab: 'targets' })
    expect(wrapper.find('button[aria-label="编辑目标"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('新增目标')
    expect(wrapper.text()).toContain('当前账号仅可查看经营目标')
    await wrapper.setProps({ initialTab: 'actions' })
    await flushPromises()
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
