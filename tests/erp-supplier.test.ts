import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SupplierEditor from '@/components/erp/ErpSupplierProfileEditor.vue'
import SupplierDetail from '@/components/erp/ErpSupplierDetail.vue'
import SupplierView from '@/views/supply-chain/erp/ErpSupplierManagementView.vue'
const api = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  can: vi.fn(),
}))
const supplier = {
  id: '1',
  supplierCode: 'SUP-1',
  supplierName: '供应商',
  contactName: '联系人',
  contactPhone: '027-12345678',
  address: '联系地址',
  bankName: '开户银行',
  bankAccountNo: '6222000012345678',
  accountName: '供应商对公账户',
  invoiceTitle: '供应商开票抬头',
  taxpayerNumber: 'EXAMPLE-TAX-001',
  statusCode: 'ACTIVE',
  remark: null,
  revision: 1,
  createdTime: '2026-11-02T00:00:00Z',
  updatedTime: '2026-11-02T00:00:00Z',
}
vi.mock('@/api/core/erp-internal', () => ({
  createErpSupplierProfile: api.create,
  updateErpSupplierProfile: api.update,
  getErpSupplierProfile: api.get,
  getErpSupplierProfiles: api.list,
  deleteErpSupplierProfile: vi.fn(),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: api.can }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  api.can.mockReturnValue(true)
  api.create.mockResolvedValue(supplier)
  api.get.mockResolvedValue(supplier)
  api.list.mockResolvedValue({ items: [supplier], total: 1 })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
const global = { plugins: [ElementPlus], stubs: { DhbPageSyncButton: true } }
describe('供应商页面', () => {
  it('新增及编辑不展示编码，八个业务字段标为必填，缺资料不发送保存请求', async () => {
    const wrapper = mount(SupplierEditor, { props: { modelValue: false }, global })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(wrapper.text()).not.toContain('供应商编码')
    expect(wrapper.text()).not.toContain('选填')
    const required = wrapper
      .findAllComponents({ name: 'ElFormItem' })
      .filter((f) => f.classes().includes('is-required'))
      .map((f) => f.props('label'))
    expect(required).toEqual([
      '供应商名称',
      '状态',
      '联系人',
      '联系电话',
      '联系地址',
      '开户名称',
      '开户银行',
      '银行账号',
    ])
    const save = () => wrapper.findAll('button').find((b) => b.text() === '保存供应商')!
    await save().trigger('click')
    await flushPromises()
    expect(api.create).not.toHaveBeenCalled()
    wrapper.findAllComponents({ name: 'ElInput' })[0]!.vm.$emit('update:modelValue', '供应商')
    await flushPromises()
    await save().trigger('click')
    await flushPromises()
    expect(api.create).not.toHaveBeenCalled()
    const values = [
      '供应商',
      '联系人',
      '027-12345678',
      '联系地址',
      '供应商对公账户',
      '开户银行',
      '6222000012345678',
      '供应商开票抬头',
      'EXAMPLE-TAX-001',
      '',
    ]
    wrapper
      .findAllComponents({ name: 'ElInput' })
      .forEach((f, i) => f.vm.$emit('update:modelValue', values[i]))
    const accountName = () =>
      wrapper
        .findAllComponents({ name: 'ElFormItem' })
        .find((f) => f.props('prop') === 'accountName')!
        .findComponent({ name: 'ElInput' })
    for (const blank of ['', '  \t  ']) {
      accountName().vm.$emit('update:modelValue', blank)
      await flushPromises()
      await save().trigger('click')
      await flushPromises()
      expect(api.create).not.toHaveBeenCalled()
    }
    accountName().vm.$emit('update:modelValue', '供应商对公账户')
    await flushPromises()
    await save().trigger('click')
    await flushPromises()
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierName: '供应商',
        contactName: '联系人',
        contactPhone: '027-12345678',
        address: '联系地址',
        bankName: '开户银行',
        bankAccountNo: '6222000012345678',
        statusCode: 'ACTIVE',
        accountName: '供应商对公账户',
        invoiceTitle: '供应商开票抬头',
        taxpayerNumber: 'EXAMPLE-TAX-001',
      }),
    )
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true, supplierId: '1' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('SUP-1')
    expect(
      wrapper.findAllComponents({ name: 'ElInput' }).map((input) => input.props('modelValue')),
    ).toContain('EXAMPLE-TAX-001')
    for (const blank of ['', '  \t  ']) {
      accountName().vm.$emit('update:modelValue', blank)
      await flushPromises()
      await wrapper
        .findAll('button')
        .find((b) => b.text() === '保存供应商')!
        .trigger('click')
      await flushPromises()
      expect(api.update).not.toHaveBeenCalled()
    }
    accountName().vm.$emit('update:modelValue', '供应商对公账户')
    api.update.mockResolvedValue({ ...supplier, taxpayerNumber: '' })
    wrapper
      .findAllComponents({ name: 'ElFormItem' })
      .find((f) => f.props('prop') === 'taxpayerNumber')!
      .findComponent({ name: 'ElInput' })
      .vm.$emit('update:modelValue', '')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '保存供应商')!
      .trigger('click')
    await flushPromises()
    expect(api.update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        accountName: '供应商对公账户',
        invoiceTitle: '供应商开票抬头',
        taxpayerNumber: '',
        revision: 1,
      }),
    )
    wrapper.unmount()
  })
  it('详情用只读分组展示完整资料，不渲染输入控件', async () => {
    const wrapper = mount(SupplierDetail, { props: { modelValue: false, supplierId: '1' }, global })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(wrapper.text()).toContain('SUP-1')
    expect(wrapper.text()).toContain('开户银行')
    expect(wrapper.text()).toContain('6222000012345678')
    expect(wrapper.text()).toContain('财务信息')
    expect(wrapper.text()).toContain('供应商对公账户')
    expect(wrapper.text()).toContain('供应商开票抬头')
    expect(wrapper.text()).toContain('EXAMPLE-TAX-001')
    expect(wrapper.find('input').exists()).toBe(false)
    wrapper.unmount()
  })
  it('列表突出联系信息和状态，银行信息留在详情，独立筛选并支持重置', async () => {
    const wrapper = mount(SupplierView, {
      global: {
        ...global,
        stubs: { ...global.stubs, ErpSupplierDetail: true, ErpSupplierProfileEditor: true },
      },
    })
    await flushPromises()
    expect(wrapper.find('.page-heading').exists()).toBe(false)
    const headings = wrapper.findAll('th').map((t) => t.text())
    expect(headings).toContain('状态')
    expect(headings).not.toContain('银行账号')
    expect(wrapper.text()).toContain('2026-11-02 08:00:00')
    const inputs = wrapper.findAllComponents({ name: 'ElInput' })
    inputs[0]!.vm.$emit('update:modelValue', ' SUP-1 ')
    inputs[1]!.vm.$emit('update:modelValue', '供应商')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ supplierCode: 'SUP-1', supplierName: '供应商', begin: 0 }),
    )
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '重置')!
      .trigger('click')
    await flushPromises()
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ supplierCode: undefined, supplierName: undefined }),
    )
    wrapper.unmount()
  })
  it('供应商维护操作与后端供应链写入权限保持一致', async () => {
    api.can.mockImplementation((permission: string) => permission === 'erp:supply:write')
    const wrapper = mount(SupplierView, {
      global: {
        ...global,
        stubs: { ...global.stubs, ErpSupplierDetail: true, ErpSupplierProfileEditor: true },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('新增供应商')
    expect(wrapper.text()).toContain('编辑')
    expect(wrapper.text()).toContain('删除')
    wrapper.unmount()
    api.can.mockReturnValue(false)
    const readonly = mount(SupplierView, {
      global: {
        ...global,
        stubs: { ...global.stubs, ErpSupplierDetail: true, ErpSupplierProfileEditor: true },
      },
    })
    await flushPromises()
    expect(readonly.text()).not.toContain('新增供应商')
    expect(readonly.text()).not.toContain('编辑')
    expect(readonly.text()).not.toContain('删除')
    expect(readonly.text()).toContain('查看')
    readonly.unmount()
  })
})
