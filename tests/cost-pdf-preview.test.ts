import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Preview from '@/views/supply-chain/cost/CostPdfPreview.vue'
import { getDocument } from 'pdfjs-dist'

vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }))
let wrapper: VueWrapper | undefined
const render = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }))
const pdf = () => ({
  numPages: 2,
  getPage: vi.fn(async () => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 500 * scale, height: 700 * scale }),
    render,
  })),
})
beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})
const open = () =>
  mount(Preview, {
    props: { name: '回单.pdf', url: 'https://files.invalid/a.pdf' },
    global: { plugins: [ElementPlus] },
  })

describe('业务 PDF 查看', () => {
  it('按页绘制文件，翻页前取消前次任务；卸载销毁读取任务', async () => {
    const document = pdf(),
      destroy = vi.fn(async () => {})
    vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve(document), destroy } as never)
    wrapper = open()
    await flushPromises()
    expect(wrapper.text()).toContain('第 1 / 2 页')
    expect(wrapper.get('canvas').attributes('aria-label')).toBe('回单.pdf，第1页')
    await wrapper
      .findAll('button')
      .find((x) => x.text() === '下一页')!
      .trigger('click')
    await flushPromises()
    expect(document.getPage).toHaveBeenLastCalledWith(2)
    expect(wrapper.text()).toContain('第 2 / 2 页')
    wrapper.unmount()
    wrapper = undefined
    expect(destroy).toHaveBeenCalledOnce()
  })
  it('无法读取时显示可执行提示，不将凭证地址及签名暴露到错误文案', async () => {
    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.reject(new Error('signed private URL')),
      destroy: vi.fn(async () => {}),
    } as never)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    wrapper = open()
    await flushPromises()
    expect(wrapper.text()).toContain('文件暂时无法预览，请下载后查看。')
    expect(wrapper.text()).not.toContain('signed private')
    warn.mockRestore()
  })
  it('更换文件后迟到的旧文件不能覆盖当前页数或画布', async () => {
    let resolve!: (value: unknown) => void
    const old = {
        promise: new Promise((done) => {
          resolve = done
        }),
        destroy: vi.fn(async () => {}),
      },
      current = pdf()
    vi.mocked(getDocument)
      .mockReturnValueOnce(old as never)
      .mockReturnValueOnce({
        promise: Promise.resolve(current),
        destroy: vi.fn(async () => {}),
      } as never)
    wrapper = open()
    await flushPromises()
    await wrapper.setProps({ url: 'https://files.invalid/b.pdf' })
    await flushPromises()
    const previous = pdf()
    resolve(previous)
    await flushPromises()
    expect(previous.getPage).not.toHaveBeenCalled()
    expect(current.getPage).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('第 1 / 2 页')
  })
})
