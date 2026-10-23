import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import ElementPlus from 'element-plus'
import Attachments from '@/views/supply-chain/hr/components/PayrollPaymentAttachments.vue'
import type { PayrollPayment, PayrollRecord } from '@/api/core/payroll'
const api = vi.hoisted(() => ({ content: vi.fn(), upload: vi.fn(), detail: vi.fn(), validate: vi.fn() }))
vi.mock('@/api/core/payroll-payment-attachments', () => ({ payrollPaymentAttachmentContent: api.content,
  uploadPayrollPaymentAttachment: api.upload }))
vi.mock('@/api/core/payroll', () => ({ getPayrollDetail: api.detail }))
vi.mock('@/views/supply-chain/cost/cost-attachment-draft', () => ({ appendCostAttachmentFiles: api.validate }))
const file = { id: 'F', fileName: '工资凭证.pdf', contentType: 'application/pdf', size: 20,
  createdBy: 'U', createdByName: '李四', createdTime: '2026-10-23T00:00:00Z' }
const props = (id = 'A') => ({ payroll: { id, revision: 3 } as PayrollRecord,
  payment: { id: `P-${id}`, attachments: [file] } as PayrollPayment, canUpload: true })
const global = { plugins: [ElementPlus], stubs: { CostFilePreview: true } }
let wrapper: VueWrapper
const create = vi.fn(() => 'blob:protected-receipt'), revoke = vi.fn()
const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL
beforeEach(() => {
  vi.resetAllMocks()
  URL.createObjectURL = create; URL.revokeObjectURL = revoke
  create.mockReturnValue('blob:protected-receipt')
  api.validate.mockImplementation(async (_current, files) => [{ file: files[0] }])
})
afterEach(() => { wrapper?.unmount(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke })
const preview = (child = wrapper) => child.findComponent({ name: 'CostFilePreview' })
async function open(child = wrapper) {
  await child.findAll('button').find(button => button.text() === file.fileName)!.trigger('click')
}
async function choose(child = wrapper) {
  const input = child.get('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: [new File(['%PDF-1.7'], '回单.pdf', { type: 'application/pdf' })], configurable: true })
  await input.trigger('change'); await flushPromises()
}
describe('工资发放凭证异步交互', () => {
  it('切换工资或付款后，旧下载响应不能显示在新单据中', async () => {
    let resolve!: (value: Blob) => void
    api.content.mockImplementation(() => new Promise(done => { resolve = done }))
    wrapper = mount(Attachments, { props: props(), global })
    await open()
    await wrapper.setProps(props('B'))
    resolve(new Blob(['%PDF-1.7'], { type: 'application/pdf' })); await flushPromises()
    expect(preview().props('modelValue')).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })
  it('离开缓存页面后迟到的凭证响应不会重新弹出，返回后仍可打开', async () => {
    let resolve!: (value: Blob) => void
    api.content.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const shown = ref(true)
    wrapper = mount(defineComponent({ setup: () => () => h(KeepAlive, null,
      { default: () => shown.value ? h(Attachments, props()) : h('div', '其他页面') }) }), { global })
    const child = wrapper.findComponent(Attachments)
    await open(child); shown.value = false; await nextTick()
    resolve(new Blob(['%PDF-1.7'])); await flushPromises()
    expect(preview(child).props('modelValue')).toBe(false)
    expect(create).not.toHaveBeenCalled()
    shown.value = true; await nextTick()
    api.content.mockResolvedValue(new Blob(['%PDF-1.7']))
    await open(child); await flushPromises()
    expect(preview(child).props('modelValue')).toBe(true)
  })
  it('上传未返回时切换工资，不能用旧结果覆盖新工资详情', async () => {
    let resolve!: () => void
    api.upload.mockImplementation(() => new Promise<void>(done => { resolve = done }))
    wrapper = mount(Attachments, { props: props(), global })
    await choose()
    expect(api.upload).toHaveBeenCalledWith('A', 'P-A', 3, expect.any(File))
    await wrapper.setProps(props('B'))
    resolve(); await flushPromises()
    expect(wrapper.emitted('updated')).toBeUndefined()
    expect(api.detail).not.toHaveBeenCalled()
  })
  it('同一工资正常上传后刷新详情，失败显示提示且允许重试', async () => {
    const fresh = { ...props().payroll, revision: 3 }
    api.upload.mockResolvedValue(file); api.detail.mockResolvedValue(fresh)
    wrapper = mount(Attachments, { props: props(), global })
    await choose()
    expect(wrapper.emitted('updated')?.[0]).toEqual([fresh])
    api.upload.mockRejectedValue(new Error('工资单已更新，请刷新后上传凭证'))
    await choose()
    expect(wrapper.text()).toContain('工资单已更新')
    expect(wrapper.get('input[type=file]').attributes('disabled')).toBeUndefined()
  })
  it('无凭证显示短横线，只读账号不提供上传入口', () => {
    wrapper = mount(Attachments, { props: { ...props(), payment: { id: 'P', attachments: [] } as unknown as PayrollPayment,
      canUpload: false }, global })
    expect(wrapper.text()).toBe('-')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
