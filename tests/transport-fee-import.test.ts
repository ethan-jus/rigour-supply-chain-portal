import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Dialog from '@/views/supply-chain/cost/TransportFeeImportDialog.vue'
const api = vi.hoisted(() => ({ preview: vi.fn(), apply: vi.fn() }))
vi.mock('@/api/core/transport-records', () => ({
  previewTransportFees: api.preview,
  applyTransportFees: api.apply,
}))
vi.mock('@/views/supply-chain/cost/cost-dictionaries', () => ({
  costOptions: () => [{ value: 'SF', label: '顺丰' }],
}))
let wrapper: ReturnType<typeof mount>
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})
const item = (line: number, state: string) => ({
  line,
  trackingNo: `SF00${line}`,
  amount: 10.01,
  remark: '',
  costId: `C${line}`,
  documentNo: `COST${line}`,
  revision: 1,
  state,
  message: state === 'READY' ? '可补录运费' : '已有运费，不覆盖',
})
async function setup() {
  api.preview.mockResolvedValue({
    fileHash: 'hash',
    items: [item(2, 'READY'), item(3, 'CONFLICT')],
  })
  wrapper = mount(Dialog, {
    props: { modelValue: true },
    attachTo: document.body,
    global: { plugins: [ElementPlus] },
  })
  await flushPromises()
  return wrapper
}
function button(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === text,
  )!
}
async function choose(size = 10) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  const file = new File([new Uint8Array(size)], '运费.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises()
  return file
}
describe('批量补录运费', () => {
  it('必须先选择文件；错误匹配不可选，提交只包含已选明细', async () => {
    await setup()
    expect(button('核对文件').disabled).toBe(true)
    const file = await choose()
    button('核对文件').click()
    await flushPromises()
    const boxes = [
      ...document.querySelectorAll<HTMLInputElement>('.el-table__body input[type="checkbox"]'),
    ]
    expect(boxes).toHaveLength(2)
    expect(boxes[1]!.disabled).toBe(true)
    boxes[0]!.click()
    await flushPromises()
    api.apply.mockResolvedValue({
      fileHash: 'hash',
      items: [{ ...item(2, 'IMPORTED'), message: '运费已补录' }],
    })
    button('补录选中运费（1）').click()
    await flushPromises()
    expect(api.apply).toHaveBeenCalledWith(file, 'hash', undefined, [item(2, 'READY')])
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(document.body.textContent).toContain('已补录 1 条')
    expect(button('补录选中运费（0）').disabled).toBe(true)
  })
  it('导入失败保留文件及预览，支持重新匹配，不自动创建运输', async () => {
    await setup()
    const file = await choose()
    button('核对文件').click()
    await flushPromises()
    document.querySelector<HTMLInputElement>('.el-table__body input[type="checkbox"]')!.click()
    await flushPromises()
    api.apply.mockRejectedValue(new Error('连接断开'))
    button('补录选中运费（1）').click()
    await flushPromises()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(document.body.textContent).toContain('运费.xlsx')
    button('重新匹配').click()
    await flushPromises()
    expect(api.preview).toHaveBeenLastCalledWith(file, undefined)
  })
  it('非空文件限制在匹配前执行', async () => {
    await setup()
    await choose(0)
    expect(document.body.textContent).toContain('非空xlsx文件')
    expect(button('核对文件').disabled).toBe(true)
    expect(api.preview).not.toHaveBeenCalled()
  })
})
