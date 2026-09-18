import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessage } from 'element-plus'
import CustomerShippingAddresses from '@/views/supply-chain/crm/CustomerShippingAddresses.vue'
import { getCustomerShippingAddresses, saveCustomerShippingAddress, type CustomerShippingAddressView } from '@/api/core/crm'
vi.mock('@/api/core/crm', () => ({ getCustomerShippingAddresses: vi.fn(), saveCustomerShippingAddress: vi.fn(), deleteCustomerShippingAddress: vi.fn() }))
let wrapper: VueWrapper
const button = (name: string) => wrapper.findAll('button').find(b => b.text() === name)!
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCustomerShippingAddresses).mockResolvedValue([])
  vi.spyOn(ElMessage, 'warning').mockImplementation(() => ({ close: vi.fn() }))
  vi.spyOn(ElMessage, 'success').mockImplementation(() => ({ close: vi.fn() }))
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); document.body.innerHTML = '' })
async function render(canEdit = true) {
  wrapper = mount(CustomerShippingAddresses, { props: { customerId: 17, canEdit }, attachTo: document.body, global: { plugins: [ElementPlus], stubs: { teleport: true } } })
  await flushPromises()
}
describe('客户收货地址', () => {
  it('空收货信息不提交，完整地址与当前客户关联并刷新', async () => {
    await render()
    await button('新增收货地址').trigger('click'); await flushPromises()
    await button('保存').trigger('click'); await flushPromises()
    expect(saveCustomerShippingAddress).not.toHaveBeenCalled()
    const inputs = wrapper.findAll('.el-dialog input')
    for (const [i, text] of ['收货单位甲', '收货人甲', '13800000001', '浙江省杭州市西湖区', '一号路1号'].entries()) await inputs[i].setValue(text)
    await button('保存').trigger('click'); await flushPromises()
    expect(saveCustomerShippingAddress).toHaveBeenCalledWith(17, null, expect.objectContaining({ contact: '收货人甲', phone: '13800000001', regionText: '浙江省杭州市西湖区', addressDetail: '一号路1号', defaultAddress: true }))
    expect(getCustomerShippingAddresses).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })
  it('只读客户不提供修改入口，切换客户后旧地址响应不会串户', async () => {
    let resolve!: (value: CustomerShippingAddressView[]) => void
    vi.mocked(getCustomerShippingAddresses).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    await render(false)
    expect(wrapper.text()).not.toContain('新增收货地址')
    await wrapper.setProps({ customerId: 18 }); await flushPromises()
    resolve([{ id: 'old', contact: '旧客户收货人', phone: '13800000001', fullAddress: '旧地址', defaultAddress: true, revision: 1, consignee: '', regionText: '', addressDetail: '' }])
    await flushPromises()
    expect(wrapper.text()).not.toContain('旧客户收货人')
    expect(getCustomerShippingAddresses).toHaveBeenLastCalledWith(18)
  })
})
