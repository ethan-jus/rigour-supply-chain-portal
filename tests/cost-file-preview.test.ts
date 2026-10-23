import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import Preview from '@/views/supply-chain/cost/CostFilePreview.vue'
import Attachments from '@/views/supply-chain/cost/CostAttachments.vue'
import { getCostAttachments, getCostAttachmentUrl, uploadCostAttachment, type CostRecord } from '@/api/core/cost'
vi.mock('@/api/core/cost', () => ({
  getCostAttachments: vi.fn(),
  getCostAttachmentUrl: vi.fn(),
  uploadCostAttachment: vi.fn(),
}))
vi.mock('@/utils/audit-actor', () => ({ auditActorLabel: () => '管理员' }))
const file = {
  id: 'file',
  fileName: '费用票据.pdf',
  contentType: 'application/pdf',
  size: 613,
  createdBy: 'login-user',
  createdTime: '2026-10-22T09:03:27Z',
}
let wrapper: VueWrapper
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getCostAttachments).mockResolvedValue([file])
})
afterEach(() => wrapper?.unmount())
describe('费用票据查看', () => {
  it('切换单据后旧上传结果不刷新或改变新单据', async () => {
    let resolve!: (value: typeof file) => void
    vi.mocked(uploadCostAttachment).mockImplementation(() => new Promise(done => { resolve = done }))
    wrapper = mount(Attachments, { props: { category: 'expenses',
      row: { id: 'first', statusCode: 'DRAFT' } as CostRecord, editable: true },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } } })
    await flushPromises()
    const input = wrapper.get('input[type=file]')
    Object.defineProperty(input.element, 'files', { value: [new File(['%PDF-1.7'], '凭证.pdf', { type: 'application/pdf' })] })
    await input.trigger('change')
    await wrapper.setProps({ row: { id: 'second', statusCode: 'DRAFT' } as CostRecord })
    await flushPromises()
    resolve(file); await flushPromises()
    expect(wrapper.emitted('changed')).toBeUndefined()
    expect(wrapper.findComponent({ name: 'CostFilePreview' }).props('modelValue')).toBe(false)
  })
  it('离开缓存页面后迟到的下载地址不能在其他页面弹出', async () => {
    let resolve!: (value: string) => void
    vi.mocked(getCostAttachmentUrl).mockImplementation(() => new Promise(done => { resolve = done }))
    const shown = ref(true)
    wrapper = mount(defineComponent({ setup: () => () => h(KeepAlive, null,
      { default: () => shown.value ? h(Attachments, { category: 'expenses',
        row: { id: 'bill', statusCode: 'VOID' } as CostRecord, editable: false }) : h('div', '其他页面') }) }),
      { global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } } })
    await flushPromises()
    const child = wrapper.findComponent(Attachments)
    await child.findAll('button').find(button => button.text() === '费用票据.pdf')!.trigger('click')
    shown.value = false; await nextTick()
    resolve('https://files.invalid/old.pdf'); await flushPromises()
    expect(child.findComponent({ name: 'CostFilePreview' }).props('modelValue')).toBe(false)
  })
  it('签名地址获取后在页面内预览，保留用户直接点击的打开链接', async () => {
    vi.mocked(getCostAttachmentUrl).mockResolvedValue('https://files.invalid/test.pdf')
    wrapper = mount(Attachments, {
      props: {
        category: 'expenses',
        row: { id: 'bill', statusCode: 'VOID' } as CostRecord,
        editable: false,
      },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '费用票据.pdf')!
      .trigger('click')
    await flushPromises()
    expect(getCostAttachmentUrl).toHaveBeenCalledWith('expenses', 'bill', 'file')
    expect(wrapper.findComponent({ name: 'CostFilePreview' }).props()).toMatchObject({
      modelValue: true,
      url: 'https://files.invalid/test.pdf',
      name: '费用票据.pdf',
      type: 'application/pdf',
    })
  })
  it('切换单据后旧地址请求不能打开其他单据的预览', async () => {
    let resolve!: (value: string) => void
    vi.mocked(getCostAttachmentUrl).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    wrapper = mount(Attachments, {
      props: {
        category: 'expenses',
        row: { id: 'first', statusCode: 'VOID' } as CostRecord,
        editable: false,
      },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '费用票据.pdf')!
      .trigger('click')
    await wrapper.setProps({ row: { id: 'second', statusCode: 'VOID' } as CostRecord })
    resolve('https://files.invalid/old.pdf')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'CostFilePreview' }).props('modelValue')).toBe(false)
  })
  it('图片与 PDF 使用对应预览，打开文件为真实链接且关闭按钮可用', async () => {
    wrapper = mount(Preview, {
      props: { modelValue: true, name: '现场照片.png', type: 'image/png', url: 'blob:local-test' },
      global: {
        plugins: [ElementPlus],
        stubs: { ElDialog: { template: '<div><slot/><slot name="footer"/></div>' } },
      },
    })
    expect(wrapper.get('img').attributes('alt')).toBe('现场照片.png')
    expect(wrapper.get('a').attributes()).toMatchObject({
      href: 'blob:local-test',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    await wrapper.setProps({
      name: '票据.pdf',
      type: 'application/pdf',
      url: 'https://files.invalid/test.pdf',
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('iframe').attributes()).toMatchObject({
      src: 'https://files.invalid/test.pdf',
      title: '票据.pdf',
      referrerpolicy: 'no-referrer',
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '关闭预览')!
      .trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })
})
