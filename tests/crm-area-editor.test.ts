import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessage } from 'element-plus'
import CrmCustomerDictionaryView from '@/views/supply-chain/crm/CrmCustomerDictionaryView.vue'
import { getAllCrmCustomerAreas, updateCrmCustomerArea, type CrmDictionaryView } from '@/api/core/crm'

vi.mock('vue-router', () => ({ useRoute: () => ({ meta: { routeKey: 'supply.crm.customers.areas' } }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/supply/DhbPageSyncButton.vue', () => ({ default: { template: '<span />' } }))
vi.mock('@/api/core/crm', () => ({ getAllCrmCustomerAreas: vi.fn(), getCrmCustomerTypes: vi.fn(), updateCrmCustomerArea: vi.fn(), createCrmCustomerArea: vi.fn(), deleteCrmCustomerArea: vi.fn() }))

const area: CrmDictionaryView = { id: 'city-id', code: 'CITY', name: '唐山市', parentId: null, parentCode: null, status: 'ACTIVE', syncedAt: null, revision: 2, sortOrder: 0, sourceCode: '1031', sourceLinked: true }
let wrapper: VueWrapper
const button = (name: string) => wrapper.findAll('button').find(item => item.text() === name)!
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAllCrmCustomerAreas).mockResolvedValue([area])
  vi.mocked(updateCrmCustomerArea).mockResolvedValue(area)
  vi.spyOn(ElMessage, 'success').mockImplementation(() => ({ close: vi.fn() }))
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); document.body.innerHTML = '' })

describe('地区订货宝编号维护', () => {
  it.each(['1032', ''])('回显编号及实际关联，保存编号 %s 时保留地区身份和版本', async (code) => {
    wrapper = mount(CrmCustomerDictionaryView, { attachTo: document.body, global: { plugins: [ElementPlus], stubs: { teleport: true, ElTreeSelect: true, ElSelect: true, ElOption: true, SupplyPageTitle: { template: '<h1><slot /></h1>' } } } })
    await flushPromises()
    await button('编辑').trigger('click')
    await flushPromises()
    const input = wrapper.get('input[placeholder="订货宝页面中的地区编号，如 1031"]')
    expect((input.element as HTMLInputElement).value).toBe('1031')
    expect(wrapper.get('.el-dialog').text()).toContain('已关联')
    await input.setValue(code)
    await button('保存').trigger('click')
    await flushPromises()
    expect(updateCrmCustomerArea).toHaveBeenCalledWith('city-id', expect.objectContaining({ sourceCode: code, areaName: '唐山市', revision: 2 }))
    expect(getAllCrmCustomerAreas).toHaveBeenCalledTimes(2)
  })
})
