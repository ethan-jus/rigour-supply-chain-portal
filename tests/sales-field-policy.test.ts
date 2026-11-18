import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElInputNumber, ElSwitch } from 'element-plus'
import SalesFieldPolicy from '@/views/supply-chain/sales/SalesFieldPolicy.vue'
const mocks = vi.hoisted(() => ({ list: vi.fn(), teams: vi.fn(), publish: vi.fn(), writable: true }))
vi.mock('@/api/core/sales-field-policy', () => ({ salesFieldPolicyApi: mocks }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => mocks.writable }) }))
const fixture = { id: 'v1', versionNo: 1, publishStatus: 'PUBLISHED', createdAt: '2026-11-17T10:00:00Z', effectiveFrom:'2026-11-17T10:00:00Z', policy: {
  policyCode: 'FIELD-DEFAULT', policyName: '默认外勤规则', timezoneId: 'Asia/Shanghai', businessDayCutoff: '04:00:00',
  standardWorkMinutes: 480, minimumWorkMinutes: 240, allowResume: true, workHoursEnabled: true, allowAdjustment: true,
  adjustmentDeadlineHours: 24, locationEnabled: true, locationIntervalMinutes: 20, minimumLocationAccuracyMeters: 100,
  offlineUploadDeadlineMinutes: 120, scopeType: 'EMPLOYEE', scopeId: 'employee-1', publish: true, expectedVersion: 1,
} }
let wrapper: VueWrapper
beforeEach(() => { vi.clearAllMocks(); mocks.writable = true; mocks.teams.mockResolvedValue([]); mocks.list.mockResolvedValue([fixture]); mocks.publish.mockResolvedValue({ versionNo: 2 }) })
afterEach(() => wrapper?.unmount())
async function start() { wrapper = mount(SalesFieldPolicy, { global: { plugins: [ElementPlus] } }); await flushPromises() }
async function edit(value: number | undefined) { wrapper.findAllComponents(ElInputNumber)[2].vm.$emit('update:modelValue', value); await flushPromises() }
function publishButton() { return wrapper.findAll('button').find(button => button.text() === '发布新版本')! }
it('publishes the interval while retaining the loaded scope and attendance settings', async () => {
  await start(); await edit(1); await wrapper.find('form').trigger('submit'); await flushPromises()
  expect(mocks.publish).toHaveBeenCalledExactlyOnceWith({...fixture.policy,locationIntervalMinutes:1})
  expect(wrapper.text()).toContain('已发布 v2')
})
it('blocks empty input and users without publication permission', async () => {
  await start(); await edit(undefined); expect(publishButton().attributes('disabled')).toBeDefined()
  await edit(1); mocks.writable = false
  wrapper.unmount(); await start(); await edit(1)
  expect(publishButton().attributes('disabled')).toBeDefined(); expect(mocks.publish).not.toHaveBeenCalled()
})
it('retains the proposed interval on a stale-version rejection and shows the error', async () => {
  mocks.publish.mockRejectedValue(new Error('外勤规则已更新，请刷新后重新确认'))
  await start(); await edit(1); await wrapper.find('form').trigger('submit'); await flushPromises()
  expect(wrapper.text()).toContain('外勤规则已更新')
  expect(wrapper.findAllComponents(ElInputNumber)[2].props('modelValue')).toBe(1)
  expect(wrapper.text()).not.toContain('已发布 v2')
})

it('all switches are editable and publish the same complete rule version',async()=>{
 await start()
 for(const control of wrapper.findAllComponents(ElSwitch))control.vm.$emit('update:modelValue',false)
 await flushPromises();await wrapper.find('form').trigger('submit');await flushPromises()
 expect(mocks.publish).toHaveBeenCalledWith({...fixture.policy,allowResume:false,workHoursEnabled:false,locationEnabled:false,allowAdjustment:false})
})
it('keeps multi-scope policies from being silently narrowed',async()=>{
 mocks.list.mockResolvedValue([fixture,{...fixture,policy:{...fixture.policy,scopeId:'employee-2'}}])
 await start();await edit(1);expect(publishButton().attributes('disabled')).toBeDefined()
})
