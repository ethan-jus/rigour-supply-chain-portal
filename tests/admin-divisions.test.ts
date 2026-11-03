import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import AdminDivisionView from '@/views/supply-chain/settings/AdminDivisionView.vue'
import { adminDivisionApi } from '@/api/core/admin-divisions'
import { buildAdminAreaTree } from '@/utils/admin-divisions'
import { territoryContext } from './fixtures/store-territories'

vi.mock('@/api/core/admin-divisions', () => ({ adminDivisionApi: { catalog: vi.fn() } }))
let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(adminDivisionApi.catalog).mockResolvedValue(structuredClone(territoryContext.catalog))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})
async function page() {
  wrapper = mount(AdminDivisionView, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  return wrapper
}
async function search(view: VueWrapper, value: string) {
  await view.get('input[aria-label="地区名称或编码"]').setValue(value)
  await view.get('form').trigger('submit')
  await flushPromises()
}
describe('独立行政区划目录', () => {
  it('搜索区县保留完整路径及大区，查询不读取部门接口', async () => {
    const view = await page()
    expect(view.text()).toContain('行政区划')
    expect(view.text()).not.toContain('设置地区')
    await search(view, '330105')
    expect(view.text()).toContain('浙江省 / 杭州市 / 拱墅区')
    expect(view.text()).toContain('华东')
    expect(view.findAll('tbody tr').filter((row) => row.text().includes('330105'))).toHaveLength(1)
    expect(view.text()).not.toContain('兰州市')
    expect(adminDivisionApi.catalog).toHaveBeenCalledTimes(1)
  })
  it('空结果和重置恢复目录；刷新失败清除旧目录', async () => {
    const view = await page()
    await search(view, '不存在地区')
    expect(view.text()).toContain('没有匹配的行政区划')
    await view
      .findAll('button')
      .find((button) => button.text() === '重置')!
      .trigger('click')
    await flushPromises()
    expect(view.text()).toContain('浙江省')
    vi.mocked(adminDivisionApi.catalog).mockRejectedValue(new Error('没有目录读取权限'))
    await view
      .findAll('button')
      .find((button) => button.text() === '刷新')!
      .trigger('click')
    await flushPromises()
    expect(view.text()).toContain('没有目录读取权限')
    expect(view.text()).not.toContain('浙江省')
  })
  it('按省份浏览直属地区，按大区和重置恢复范围', async () => {
    const view = await page()
    await view
      .findAll('.province-item')
      .find((row) => row.text().includes('浙江省'))!
      .trigger('click')
    await flushPromises()
    expect(view.find('.scope-title').text()).toContain('浙江省')
    expect(view.find('.master-table').text()).toContain('杭州市')
    expect(view.find('.master-table').text()).not.toContain('甘肃省')
    await view
      .findAll('.region-select')
      .find((row) => row.text().startsWith('西北'))!
      .trigger('click')
    await flushPromises()
    expect(view.find('.master-table').text()).toContain('甘肃省')
    expect(view.find('.master-table').text()).not.toContain('浙江省')
  })
  it('大区可独立折叠，切换省份不丢失查询范围，等级有独立样式', async () => {
    const view = await page()
    const toggle = view.get('button[aria-label="展开华东地区"]')
    await toggle.trigger('click')
    expect(view.get('button[aria-label="折叠华东地区"]').attributes('aria-expanded')).toBe('true')
    await view
      .findAll('.province-item')
      .find((row) => row.text().includes('浙江省'))!
      .trigger('click')
    expect(view.get('.scope-title').text()).toBe('浙江省')
    await view.get('button[aria-label="折叠华东地区"]').trigger('click')
    expect(view.get('.scope-title').text()).toBe('浙江省')
    expect(view.findAll('.admin-level--prefecture').length).toBeGreaterThan(0)
    await search(view, '330105')
    expect(view.find('.admin-level--county').text()).toBe('县级')
  })
  it('导出选择与列表等级独立，当前省级范围可导出省份本身', async () => {
    const view = await page()
    await view.findAll('.province-item').find(row => row.text().includes('浙江省'))!.trigger('click')
    await view.findAll('button').find(button => button.text() === '导出 Excel')!.trigger('click')
    await flushPromises()
    expect(view.find('.export-summary').text()).toContain('1 条省级数据')
    await view.find('input[type="radio"][value="PREFECTURE"]').setValue()
    expect(view.find('.export-summary').text()).toContain('地级数据')
    expect(view.get('.scope-title').text()).toBe('浙江省')
  })
  it('保留直辖市直管区县和不设区的地级市，不创建虚假节点', () => {
    const tree = buildAdminAreaTree([
      { code: '110000', name: '北京市', level: 'PROVINCE', parentCode: null, regionCode: 'NORTH' },
      { code: '110101', name: '东城区', level: 'COUNTY', parentCode: '110000', regionCode: null },
      { code: '440000', name: '广东省', level: 'PROVINCE', parentCode: null, regionCode: 'SOUTH' },
      {
        code: '441900',
        name: '东莞市',
        level: 'PREFECTURE',
        parentCode: '440000',
        regionCode: null,
      },
    ])
    expect(tree[0]!.children[0]).toMatchObject({
      code: '110101',
      path: '北京市 / 东城区',
      region: 'NORTH',
    })
    expect(tree[1]!.children[0]).toMatchObject({ code: '441900', children: [] })
  })
})
