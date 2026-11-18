import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElDrawer, ElInput, ElInputNumber, ElRadioGroup, ElSelect, ElSwitch } from 'element-plus'
import SalesVisitPolicy from '@/views/supply-chain/sales/SalesVisitPolicy.vue'
import { copyVisitPolicy, policyChanges } from '@/views/supply-chain/sales/visit-policy-editor'
import type { VisitPolicyVersion } from '@/api/core/sales-visit-policy'

const mocks = vi.hoisted(() => ({ list: vi.fn(), publish: vi.fn(), confirm: vi.fn(), success: vi.fn(), writable: true, leave: undefined as undefined | (() => Promise<boolean>) }))
vi.mock('@/api/core/sales-visit-policy', () => ({ salesVisitPolicyApi: { list: mocks.list, publish: mocks.publish } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 'admin', displayName: '管理员' }, hasPermission: () => mocks.writable }) }))
vi.mock('vue-router', () => ({ onBeforeRouteLeave: (guard: () => Promise<boolean>) => { mocks.leave = guard }, onBeforeRouteUpdate: vi.fn() }))
// Use the package's Node entry so async-validator's CJS default is resolved as in the browser bundle.
vi.mock('element-plus', () => ({ ...createRequire(import.meta.url)('element-plus'), ElMessage: { success: mocks.success }, ElMessageBox: { confirm: mocks.confirm } }))

const fixture: VisitPolicyVersion = {
  id: 'version-4', versionNo: 4, policyCode: 'VISIT-DEFAULT', publishStatus: 'PUBLISHED', name: '默认拜访规则', scopeType: 'EMPLOYEE', scopeId: 'sales-1', createdAt: '2026-11-12T02:20:45Z', createdBy: 'admin',
  policy: { id: 'version-4', radiusMeters: 500, minimumDwellMinutes: 0, requiredPhotoCount: 1, recordingEnabled: true, minimumRecordingSeconds: 0, maximumClipGapSeconds: 30, aiAsrEnabled: true, aiRelevanceEnabled: true, aiDuplicateEnabled: true, aiAutoConfirmThreshold: null, captureRules: { requireLocationOnOpen: false, maximumLocationAccuracyMeters: 100, automaticRecording: true, automaticCheckout: true, automaticCheckoutRadiusMeters: 1000, allowPhotoImport: true, allowRecordingImport: true } },
}
const other: VisitPolicyVersion = { ...fixture, id: 'other-99', policyCode: 'OTHER', name: '其他规则', versionNo: 99 }
let wrapper: VueWrapper
async function start() { wrapper = mount(SalesVisitPolicy, { attachTo: document.body, global: { plugins: [ElementPlus] } }); await flushPromises(); return wrapper }
async function button(text: string) { const target = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text || item.getAttribute('aria-label') === text); expect(target, text).toBeTruthy(); target!.click(); await flushPromises() }
async function editRadius(value = 800) { wrapper.findAllComponents(ElInputNumber)[0]!.vm.$emit('update:modelValue', value); await flushPromises() }
async function openReview(version = 5) { await button('查看变更并发布'); expect(document.body.textContent).toContain(`发布后为 v${version}`) }

beforeEach(() => {
  vi.clearAllMocks(); mocks.writable = true
  mocks.list.mockResolvedValue(structuredClone([other, fixture]))
  mocks.publish.mockResolvedValue({ policyId: 'p', policyVersionId: 'version-5', policyCode: fixture.policyCode, versionNo: 5, publishStatus: 'PUBLISHED', effectiveFrom: '2026-11-16T06:00:00Z' })
  mocks.confirm.mockRejectedValue('cancel')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

describe('拜访规则编辑与发布', () => {
  it('按规则而非全局最大版本加载，保留导入选项、空阈值和 0 秒门槛', async () => {
    await start()
    expect(wrapper.text()).toContain('生效中 v4')
    expect(wrapper.findAllComponents(ElRadioGroup).map(item => item.props('modelValue'))).toEqual(['visit', true, true])
    expect(wrapper.text()).toContain('到店、停留、照片及录音满足规则后自动通过。')
    expect(wrapper.find('.footer-status').text()).toContain('与已发布规则一致')
    expect(mocks.publish).not.toHaveBeenCalled()
    await button('发布记录')
    expect(wrapper.find('.policy-history').text()).not.toContain('v99')
  })
  it('录音门槛按分钟编辑，10 分钟发布为 600 秒并展示变更', async () => {
    await start()
    const duration = wrapper.findAllComponents(ElInputNumber).find(item => item.find('input').attributes('aria-label') === '有效拜访最低录音时长')!
    expect(duration.props('modelValue')).toBe(0)
    await duration.find('input').setValue('10'); await duration.find('input').trigger('blur'); await flushPromises(); await openReview()
    expect(document.querySelector('.change-list')?.textContent).toContain('有效拜访最低录音时长')
    expect(document.querySelector('.change-list')?.textContent).toContain('10 分钟')
    await button('发布新版本')
    expect(mocks.publish.mock.calls[0]![3]).toMatchObject({ minimumRecordingSeconds: 600, minimumDwellMinutes: 0, recordingEnabled: true })
    expect((duration.find('input').element as HTMLInputElement).value).toBe('10')
  })
  it('读取旧秒数不取整改写，清空录音时长时阻止发布', async () => {
    mocks.list.mockResolvedValueOnce([{ ...fixture, policy: { ...fixture.policy, minimumRecordingSeconds: 90 } }])
    await start()
    const duration = wrapper.findAllComponents(ElInputNumber).find(item => item.find('input').attributes('aria-label') === '有效拜访最低录音时长')!
    expect(duration.props('modelValue')).toBe(1.5)
    await editRadius(); await openReview(); await button('发布新版本')
    expect(mocks.publish.mock.calls[0]![3].minimumRecordingSeconds).toBe(90)
    duration.vm.$emit('update:modelValue', undefined); await flushPromises(); await button('查看变更并发布')
    await vi.waitFor(() => expect(wrapper.text()).toContain('请填写 0–480 分钟的录音时长'))
    expect(mocks.publish).toHaveBeenCalledTimes(1)
  })
  it('先校验和确认，再提交正确版本、范围与完整材料来源；提交成功后不再有未发布修改', async () => {
    await start(); await editRadius(); await openReview()
    expect(mocks.publish).not.toHaveBeenCalled()
    mocks.list.mockResolvedValueOnce([{ ...fixture, id: 'version-5', versionNo: 5, policy: { ...fixture.policy, radiusMeters: 800 } }])
    await button('发布新版本')
    expect(mocks.publish).toHaveBeenCalledExactlyOnceWith(4, fixture.policyCode, fixture.name, expect.objectContaining({ radiusMeters: 800, minimumRecordingSeconds: 0, aiAutoConfirmThreshold: null, captureRules: expect.objectContaining({ allowPhotoImport: true, allowRecordingImport: true }) }), 'EMPLOYEE', 'sales-1')
    expect(wrapper.find('.footer-status').text()).toContain('与已发布规则一致当前版本 v5')
    expect(mocks.success).toHaveBeenCalledWith('版本 v5 已发布，仅对新拜访生效')
  })
  it('拒绝空名称与非整数必填数值，不进入发布确认', async () => {
    await start(); await button('编辑规则名称'); await wrapper.findAllComponents(ElInput).at(-1)!.setValue('   '); await button('应用名称')
    await vi.waitFor(() => expect(document.body.textContent).toContain('请填写规则名称'))
    await button('取消'); await editRadius(1.5)
    await button('查看变更并发布')
    expect(wrapper.text()).toContain('请先修正标出的字段')
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(wrapper.findComponent(ElDrawer).props('modelValue')).toBe(false)
  })
  it('离店距离独立设置，不能小于到店范围', async () => {
    await start(); await editRadius(1200)
    const departure = wrapper.findAllComponents(ElInputNumber)[3]!
    expect(departure.props('min')).toBe(1200)
    expect(mocks.publish).not.toHaveBeenCalled()
    departure.vm.$emit('update:modelValue', 1500)
    await flushPromises(); await openReview(); await button('发布新版本')
    expect(mocks.publish.mock.calls[0]![3].captureRules.automaticCheckoutRadiusMeters).toBe(1500)
  })
  it('发布冲突保留输入，重新核对最新版本后展示差异，不直接重试旧版本', async () => {
    await start(); await editRadius(); await openReview()
    mocks.publish.mockRejectedValueOnce(new Error('政策已更新，请刷新后重新确认'))
    await button('发布新版本')
    expect(wrapper.text()).toContain('当前输入已保留')
    expect(wrapper.findAllComponents(ElInputNumber)[0]!.props('modelValue')).toBe(800)
    expect(wrapper.findAll('button').find(item => item.text() === '查看变更并发布')!.attributes('disabled')).toBeDefined()
    mocks.list.mockResolvedValueOnce([{ ...fixture, versionNo: 6, policy: { ...fixture.policy, radiusMeters: 650 } }])
    await button('核对最新版本')
    expect(wrapper.text()).toContain('已取得最新版本 v6')
    await openReview(7)
    expect(document.querySelector('.change-list')?.textContent).toContain('650 米')
    expect(document.querySelector('.change-list')?.textContent).toContain('800 米')
    expect(mocks.publish).toHaveBeenCalledTimes(1)
  })
  it('收到成功回执但历史刷新失败时仍标记已发布，避免重复提交', async () => {
    await start(); await editRadius(); await openReview(); mocks.list.mockRejectedValueOnce(new Error('网络异常'))
    await button('发布新版本')
    expect(wrapper.text()).toContain('版本 v5 已发布，历史列表暂未刷新')
    expect(wrapper.find('.footer-status').text()).toContain('与已发布规则一致当前版本 v5')
    expect(wrapper.findAll('button').find(item => item.text() === '查看变更并发布')!.attributes('disabled')).toBeDefined()
  })
  it('回执缺失时保留输入；核对发现相同配置已经发布后不再重复提交', async () => {
    await start(); await editRadius(); await openReview(); mocks.publish.mockResolvedValueOnce({})
    await button('发布新版本')
    expect(wrapper.text()).toContain('发布回执不完整')
    expect(wrapper.findAllComponents(ElInputNumber)[0]!.props('modelValue')).toBe(800)
    mocks.list.mockResolvedValueOnce([{ ...fixture, versionNo: 5, policy: { ...fixture.policy, radiusMeters: 800 } }])
    await button('核对最新版本')
    expect(wrapper.find('.footer-status').text()).toContain('与已发布规则一致当前版本 v5')
    expect(mocks.publish).toHaveBeenCalledTimes(1)
  })
  it('重复点击确认只发送一次请求', async () => {
    await start(); await editRadius(); await openReview()
    let finish!: (value: unknown) => void
    mocks.publish.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    await button('发布新版本'); await button('发布新版本')
    expect(mocks.publish).toHaveBeenCalledTimes(1)
    finish({ policyId: 'p', policyVersionId: 'v5', policyCode: fixture.policyCode, versionNo: 5, publishStatus: 'PUBLISHED', effectiveFrom: fixture.createdAt }); await flushPromises()
  })
  it('取消还原、重载、切换和离开保留编辑，并在浏览器刷新前提示', async () => {
    await start(); await editRadius(); await button('还原修改'); await button('重新加载')
    wrapper.findComponent(ElSelect).vm.$emit('change', 'OTHER'); await flushPromises()
    expect(await mocks.leave!()).toBe(false)
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.findAllComponents(ElInputNumber)[0]!.props('modelValue')).toBe(800)
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('生效中 v4')
  })
  it('确认还原使用当前基线，包含最初允许的导入选项', async () => {
    await start(); await editRadius(); mocks.confirm.mockResolvedValueOnce('confirm'); await button('还原修改')
    expect(wrapper.findAllComponents(ElInputNumber)[0]!.props('modelValue')).toBe(500)
    expect(wrapper.findAllComponents(ElRadioGroup)[1]!.props('modelValue')).toBe(true)
    expect(wrapper.find('.footer-status').text()).toContain('与已发布规则一致')
  })
  it('录音关闭时关闭自动录音和 AI 依赖，但读取规则不静默重写', async () => {
    await start(); const recording = wrapper.findAllComponents(ElSwitch)[1]!
    recording.vm.$emit('update:modelValue', false); recording.vm.$emit('change', false); await flushPromises()
    await openReview(); await button('发布新版本')
    expect(mocks.publish.mock.calls[0]![3]).toMatchObject({ recordingEnabled: false, aiAsrEnabled: false, aiRelevanceEnabled: false, aiDuplicateEnabled: false, captureRules: { automaticRecording: false } })
  })
  it('内容分析不作为核验门槛，编辑其他规则不改历史快照中的分析配置', async () => {
    await start()
    expect(wrapper.find('[aria-label="自动确认置信度"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('内容相关性')
    expect(wrapper.text()).not.toContain('重复录音')
    await editRadius(); await openReview(); await button('发布新版本')
    expect(mocks.publish.mock.calls[0]![3]).toMatchObject({ aiAsrEnabled: true, aiRelevanceEnabled: true, aiDuplicateEnabled: true, aiAutoConfirmThreshold: null })
  })
  it('名称编辑取消保留原值，应用后纳入发布差异与完整请求', async () => {
    await start(); await button('编辑规则名称')
    await wrapper.findAllComponents(ElInput).at(-1)!.setValue('未应用名称'); await button('取消')
    expect(wrapper.find('.footer-status').text()).toContain('与已发布规则一致')
    await button('编辑规则名称'); await wrapper.findAllComponents(ElInput).at(-1)!.setValue('新规则名称'); await button('应用名称')
    await openReview(); expect(document.querySelector('.change-list')?.textContent).toContain('新规则名称')
    await button('返回编辑'); await button('发布记录'); await button('返回规则'); await openReview()
    await button('发布新版本'); expect(mocks.publish.mock.calls[0]![2]).toBe('新规则名称')
  })
  it('无发布权限不提供可用提交操作', async () => {
    mocks.writable = false; await start()
    expect(wrapper.text()).toContain('当前账号没有发布销售规则权限')
    expect(wrapper.findAll('button').find(item => item.text() === '查看变更并发布')!.attributes('disabled')).toBeDefined()
  })
  it('读取失败时显示重试入口，不误允许发布默认数据', async () => {
    mocks.list.mockRejectedValueOnce(new Error('服务暂不可用')); await start()
    expect(wrapper.text()).toContain('服务暂不可用')
    expect(wrapper.text()).toContain('规则尚未加载')
    expect(mocks.publish).not.toHaveBeenCalled()
  })
})

describe('规则差异与复制', () => {
  it('复制不共享 captureRules，保留导入值，规范可选空值', () => {
    const original = structuredClone(fixture.policy); const copy = copyVisitPolicy(original)
    copy.captureRules.automaticCheckout = false
    expect(original.captureRules.automaticCheckout).toBe(true)
    expect(copy.captureRules.allowPhotoImport).toBe(true)
    expect(policyChanges(fixture.name, original, fixture.name, copy)).toEqual([expect.objectContaining({ key: 'checkout', previous: '开启', value: '关闭' }), expect.objectContaining({ key: 'departureRadius', previous: '1000 米', value: '未启用' })])
  })
})

it('首次配置通过相同发布接口创建 v1，并展示完整规则供核对', async () => {
  mocks.list.mockResolvedValue([])
  mocks.publish.mockResolvedValue({ policyId: 'p', policyVersionId: 'v1', policyCode: 'VISIT-DEFAULT', versionNo: 1, publishStatus: 'PUBLISHED', effectiveFrom: '2026-11-18T08:00:00Z' })
  await start(); await button('创建首个拜访规则'); await editRadius(800)
  const departure = wrapper.findAllComponents(ElInputNumber).find(item => item.find('input').attributes('aria-label') === '自动离店距离')!
  departure.vm.$emit('update:modelValue', 800); await flushPromises()
  await openReview(1)
  expect(document.querySelector('.change-list')?.textContent).toContain('未配置')
  await button('发布新版本')
  expect(mocks.publish).toHaveBeenCalledWith(0, 'VISIT-DEFAULT', '默认拜访规则', expect.objectContaining({ radiusMeters: 800, minimumRecordingSeconds: 600 }), 'ALL', null)
  expect(wrapper.text()).toContain('生效中 v1')
})
it('空环境中只读账号不能创建规则', async () => {
  mocks.list.mockResolvedValue([]); mocks.writable = false
  await start(); expect(wrapper.text()).not.toContain('创建首个拜访规则')
})
