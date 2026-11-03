import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElTreeSelect } from 'element-plus'
import StoreTerritoryView from '@/views/supply-chain/settings/StoreTerritoryView.vue'
import { storeTerritoryApi } from '@/api/core/store-territories'
import { territoryContext } from './fixtures/store-territories'

vi.mock('@/api/core/store-territories', () => ({
  storeTerritoryApi: { context: vi.fn(), save: vi.fn() },
}))
let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(storeTerritoryApi.context).mockResolvedValue(structuredClone(territoryContext))
  vi.mocked(storeTerritoryApi.save).mockResolvedValue(undefined)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})
async function page() {
  wrapper = mount(StoreTerritoryView, {
    attachTo: document.body,
    global: { plugins: [ElementPlus] },
  })
  await flushPromises()
  return wrapper
}
function button(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === label,
  )!
}
async function edit() {
  // The second row is the Hangzhou department, after its parent Sales department.
  wrapper!
    .findAll('button')
    .filter((b) => b.text() === '设置地区')[1]!
    .element.click()
  await flushPromises()
}
async function reason(value: string) {
  const input = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="修改原因"]')!
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}
describe('客户地域权限页面', () => {
  it('展示部门范围、上级和未配置状态，停用部门不能编辑', async () => {
    const view = await page()
    expect(view.text()).toContain('杭州市 · 330100')
    expect(view.text()).toContain('共 4 个部门 · 1 个已配置')
    expect(
      view
        .findAll('button')
        .filter((b) => b.text() === '设置地区')[3]!
        .attributes('disabled'),
    ).toBeDefined()
    await view.get('input[aria-label="搜索部门名称"]').setValue('杭州')
    expect(view.findAll('tbody tr')).toHaveLength(1)
  })
  it('只读用户没有设置入口', async () => {
    vi.mocked(storeTerritoryApi.context).mockResolvedValue({
      ...structuredClone(territoryContext),
      canWrite: false,
    })
    const view = await page()
    expect(view.text()).not.toContain('设置地区')
    expect(storeTerritoryApi.save).not.toHaveBeenCalled()
  })
  it('带版本与原因保存，成功后重新读取实际范围', async () => {
    await page()
    await edit()
    expect(button('保存范围').disabled).toBe(true)
    wrapper!.getComponent(ElTreeSelect).vm.$emit('update:modelValue', ['330000'])
    await reason('杭州部门调整为浙江全省')
    const updated = structuredClone(territoryContext)
    updated.applicationVersion = 8
    updated.departments[1]!.areas = [{ version: 'TEST-2026', code: '330000' }]
    vi.mocked(storeTerritoryApi.context).mockResolvedValue(updated)
    button('保存范围').click()
    await flushPromises()
    expect(storeTerritoryApi.save).toHaveBeenCalledWith('2', {
      applicationVersion: 7,
      catalogVersion: 'TEST-2026',
      areaCodes: ['330000'],
      reason: '杭州部门调整为浙江全省',
    })
    expect(storeTerritoryApi.context).toHaveBeenCalledTimes(2)
    expect(wrapper!.text()).toContain('浙江省 · 330000')
  })
  it('版本冲突保留编辑内容，不假报保存成功或自动覆盖', async () => {
    vi.mocked(storeTerritoryApi.save).mockRejectedValue(
      new Error('权限配置已被修改，请刷新后重新保存'),
    )
    await page()
    await edit()
    await reason('复核城市范围')
    button('保存范围').click()
    await flushPromises()
    expect(document.body.textContent).toContain('权限配置已被修改')
    expect(document.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('复核城市范围')
    expect(storeTerritoryApi.context).toHaveBeenCalledTimes(1)
    expect(storeTerritoryApi.save).toHaveBeenCalledTimes(1)
  })
  it('清空范围明确提示撤销地域授权，并发送空数组', async () => {
    await page()
    await edit()
    wrapper!.getComponent(ElTreeSelect).vm.$emit('update:modelValue', [])
    await reason('暂停本部门销售地区')
    expect(document.body.textContent).toContain('保存后将撤销此部门的客户地域范围')
    button('保存范围').click()
    await flushPromises()
    expect(storeTerritoryApi.save).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({ areaCodes: [] }),
    )
  })
  it('加载失败时不残留可编辑的旧权限', async () => {
    const view = await page()
    vi.mocked(storeTerritoryApi.context).mockRejectedValue(new Error('服务暂不可用'))
    button('刷新').click()
    await flushPromises()
    expect(view.text()).toContain('服务暂不可用')
    expect(view.text()).not.toContain('设置地区')
  })
})
