import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import View from '@/views/supply-chain/crm/CrmCustomerManagementView.vue'
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: { customerCode: '34385' } }) }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/crm', () => ({
  getInternalCrmCustomers: mocks.list,
  getInternalCrmCustomerCreators: async () => ['原始创建人'],
  getInternalCrmCustomer: mocks.detail,
  getCrmCustomerTypes: async () => ({ items: [] }),
  getAllCrmCustomerAreas: async () => [],
  createInternalCrmCustomer: mocks.create,
  updateInternalCrmCustomer: mocks.update,
  deleteInternalCrmCustomer: mocks.remove,
}))
vi.mock('@/api/core/customer-responsibility', () => ({ responsibilityEmployees: async () => [] }))
vi.mock('@/utils/business-dictionary', () => ({
  businessDictionaryOptions: () => [],
  businessDictionaryLabel: (_m: string, _d: string, code: string) => code,
  loadBusinessDictionaries: async () => {},
}))
const row = {
  id: 1,
  customerName: '验证门店',
  loginAccount: 'store-account',
  statusCode: 'ACTIVE',
  revision: 0,
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  mocks.list.mockResolvedValue({ total: 1, items: [row] })
  mocks.detail.mockResolvedValue(row)
})
function mountView() {
  return mount(View, {
    attachTo: document.body,
    global: {
      plugins: [ElementPlus],
      stubs: {
        DhbPageSyncButton: { template: '<button>同步客户</button>' },
        CustomerResponsibilityDrawer: true,
        CustomerShippingAddresses: true,
      },
    },
  })
}
it('展开日期条件后与模糊账号一起查询，重置清除全部条件并忽略旧编码参数', async () => {
  const w = mountView()
  await flushPromises()
  expect(mocks.list.mock.lastCall?.[0]).not.toHaveProperty('customerCode')
  expect(w.find('#customer-extra-filters').isVisible()).toBe(false)
  const button = (text: string) => w.findAll('button').find((b) => b.text() === text)!
  await button('展开').trigger('click')
  expect(w.find('#customer-extra-filters').isVisible()).toBe(true)
  await w.get('input[placeholder="客户名称"]').setValue('验证')
  await w.get('input[placeholder="客户账号"]').setValue('account')
  w.findComponent({ name: 'ElDatePicker' }).vm.$emit('update:modelValue', [
    '2026-09-04',
    '2026-09-15',
  ])
  await button('查询').trigger('click')
  await flushPromises()
  expect(mocks.list).toHaveBeenLastCalledWith(
    expect.objectContaining({
      customerName: '验证',
      loginAccount: 'account',
      createdFrom: '2026-09-04',
      createdTo: '2026-09-15',
      begin: 0,
      sortBy: 'businessCreatedAt',
      sortDirection: 'desc',
    }),
  )
  await button('收起').trigger('click')
  expect(w.find('#customer-extra-filters').isVisible()).toBe(false)
  await button('重置').trigger('click')
  await flushPromises()
  expect(mocks.list).toHaveBeenLastCalledWith(
    expect.objectContaining({
      customerName: undefined,
      loginAccount: undefined,
      createdFrom: undefined,
      createdTo: undefined,
    }),
  )
  w.unmount()
})
it('通过高亮客户名称打开详情，操作区不再重复提供详情按钮', async () => {
  const w = mountView()
  await flushPromises()
  expect(w.findAll('button').filter((b) => b.text() === '详情')).toHaveLength(0)
  await w.get('.customer-name-link').trigger('click')
  await flushPromises()
  expect(mocks.detail).toHaveBeenCalledWith(1)
  expect(w.text()).toContain('客户详情')
  w.unmount()
})

it('复制客户名称只写入剪贴板，不打开详情', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const w = mountView()
  await flushPromises()
  await w.get('[aria-label="复制客户名称"]').trigger('click')
  await flushPromises()
  expect(writeText).toHaveBeenCalledWith('验证门店')
  expect(mocks.detail).not.toHaveBeenCalled()
  w.unmount()
})

it('订货宝编码、关联状态和树形地区独立筛选，编码排序交给后端', async () => {
  const w = mountView()
  await flushPromises()
  await w.get('input[placeholder="订货宝客户编码"]').setValue('343')
  w.findAllComponents({ name: 'ElSelect' })
    .find((c) => c.props('placeholder') === '订货宝关联状态')!
    .vm.$emit('update:modelValue', 'UNLINKED')
  const region = w.findComponent({ name: 'ElTreeSelect' })
  expect(region.props('checkStrictly')).toBe(true)
  region.vm.$emit('update:modelValue', 'ZJ')
  await w
    .findAll('button')
    .find((b) => b.text() === '查询')!
    .trigger('click')
  await flushPromises()
  expect(mocks.list).toHaveBeenLastCalledWith(
    expect.objectContaining({
      dhbCustomerCode: '343',
      dhbLinkStatus: 'UNLINKED',
      regionCode: 'ZJ',
    }),
  )
  w.findComponent({ name: 'ElTable' }).vm.$emit('sort-change', {
    prop: 'dhbCustomerCode',
    order: 'ascending',
  })
  await flushPromises()
  expect(mocks.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ sortBy: 'dhbCustomerCode', sortDirection: 'asc', begin: 0 }),
  )
  await w
    .findAll('button')
    .find((b) => b.text() === '重置')!
    .trigger('click')
  await flushPromises()
  expect(mocks.list).toHaveBeenLastCalledWith(
    expect.objectContaining({
      dhbCustomerCode: undefined,
      dhbLinkStatus: undefined,
      regionCode: undefined,
    }),
  )
  w.unmount()
})

it.each(['新增客户', '编辑'])('%s 的必填项缺失时不发送保存请求，新增默认启用', async (action) => {
  const w = mountView()
  await flushPromises()
  await w
    .findAll('button')
    .find((b) => b.text() === action)!
    .trigger('click')
  await flushPromises()
  const editor = w.findAllComponents({ name: 'ElForm' }).find((c) => c.props('rules'))!
  expect(Object.keys(editor.props('rules'))).toEqual(
    expect.arrayContaining([
      'customerName',
      'loginAccount',
      'customerTypeCode',
      'statusCode',
      'regionCode',
      'ownerEmployeeCode',
    ]),
  )
  if (action === '新增客户') expect(editor.props('model').statusCode).toBe('ACTIVE')
  const dialog = w.findComponent({ name: 'ElDialog' })
  await dialog
    .findAll('button')
    .find((b) => b.text() === '保存')!
    .trigger('click')
  await flushPromises()
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
  expect(document.body.textContent).toContain(
    action === '新增客户' ? '请输入客户名称' : '请选择客户类型',
  )
  w.unmount()
})

it('一个客户展示多个订货宝编码，详情保持全部关联', async () => {
  const linked = { ...row, dhbCustomerCode: '31668', dhbCustomerCodes: ['31668', '32048', '32052'] }
  mocks.list.mockResolvedValue({ total: 1, items: [linked] })
  mocks.detail.mockResolvedValue(linked)
  const w = mountView()
  await flushPromises()
  expect(w.text()).toContain('31668 / 32048 / 32052')
  await w.get('.customer-name-link').trigger('click')
  await flushPromises()
  expect(w.findComponent({ name: 'ElDrawer' }).text()).toContain('31668 / 32048 / 32052')
  w.unmount()
})
it('删除确认显示客户名称，取消不会删除客户', async () => {
  const w = mountView()
  await flushPromises()
  await w.findAll('button').find((b) => b.text() === '删除')!.trigger('click')
  await flushPromises()
  const dialog = document.body.querySelector('.el-message-box')!
  expect(dialog.textContent).toContain('确定删除客户“验证门店”吗？')
  const cancel = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === '取消')!
  cancel.click()
  await flushPromises()
  expect(mocks.remove).not.toHaveBeenCalled()
  w.unmount()
})
