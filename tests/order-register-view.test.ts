import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'

const mocks = vi.hoisted(() => ({
  getOrders: vi.fn(),
  exportCsv: vi.fn(),
  getCreators: vi.fn(),
  getAllAreas: vi.fn(),
  getEmployees: vi.fn(),
  getDepartments: vi.fn(),
  downloadBlob: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/api/core/order-register', () => ({
  getOrderRegisterOrders: mocks.getOrders,
  exportOrderRegisterCsv: mocks.exportCsv,
  getOrderRegisterCreators: mocks.getCreators,
}))
vi.mock('@/api/core/crm', () => ({ getAllCrmCustomerAreas: mocks.getAllAreas }))
vi.mock('@/api/core/hr', () => ({
  getHrEmployees: mocks.getEmployees,
  hrOrganizationApi: { departments: mocks.getDepartments },
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => false }),
}))
vi.mock('@/utils/file-download', () => ({
  downloadBlob: mocks.downloadBlob,
  csvFilename: () => '订单列表-20260918.csv',
}))
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: mocks.push }),
    useRoute: () => ({ query: {} }),
  }
})

import OrderListView from '@/views/supply-chain/order/OrderListView.vue'

function pageResponse() {
  return {
    total: 3,
    begin: 0,
    step: 20,
    items: [
      {
        id: '1',
        orderNo: 'A001',
        legacyOrderNo: null,
        sourceSystemCode: 'DINGHUOBAO',
        sourceOrderNo: 'A001',
        orderNumberState: null,
        customerId: 'c1',
        customerCode: 'C001',
        customerName: '测试客户',
        regionCode: 'HZ',
        regionName: '杭州',
        ownerEmployeeCode: 'E001',
        ownerEmployeeName: '张三',
        departmentId: 1,
        departmentName: '销售部',
        orderStatusCode: 'PENDING_OUTBOUND',
        paymentStatusCode: 'UNPAID',
        originalAmount: 900,
        payableAmount: 1000,
        paidAmount: 200,
        unpaidAmount: 800,
        checkedAmount: 0,
        orderDate: '2026-09-10T08:00:00+08:00',
        shipmentTime: null,
        createdBy: '李四',
        createdTime: '2026-09-10T08:00:00+08:00',
        updatedBy: null,
        updatedTime: null,
        syncedBy: null,
        syncedAt: null,
        revision: 1,
      },
    ],
    totals: {
      originalAmount: 900,
      payableAmount: 1000,
      paidAmount: 200,
      unpaidAmount: 800,
      checkedAmount: 0,
    },
    coverage: null,
  }
}

describe('订单列表页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOrders.mockResolvedValue(pageResponse())
    mocks.getAllAreas.mockResolvedValue([])
    mocks.getDepartments.mockResolvedValue([])
    mocks.getEmployees.mockResolvedValue({ items: [] })
    mocks.getCreators.mockResolvedValue([])
    mocks.exportCsv.mockResolvedValue(new Blob(['a,b']))
  })

  it('默认按创建时间倒序加载，汇总来自服务端 totals', async () => {
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    expect(mocks.getOrders).toHaveBeenCalledTimes(1)
    expect(mocks.getOrders.mock.calls[0][0]).toMatchObject({
      begin: 0,
      step: 20,
      sortBy: 'createdTime',
      sortDirection: 'desc',
    })
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('¥1,000.00')
    expect(wrapper.text()).toContain('回款金额')
    expect(wrapper.text()).toContain('待收金额')
    expect(wrapper.text()).toContain('已核金额')
    wrapper.unmount()
  })

  it('筛选触发查询并重置页码，空条件不会发出', async () => {
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.find('input[aria-label="客户名称"]').setValue('测试客户')
    await wrapper.find('input[aria-label="客户名称"]').trigger('keyup.enter')
    await flushPromises()
    const lastCall = mocks.getOrders.mock.calls.at(-1)![0]
    expect(lastCall).toMatchObject({ customerName: '测试客户', begin: 0 })
    expect(lastCall.orderNo).toBeUndefined()
    wrapper.unmount()
  })

  it('导出与查询同筛选，不带分页参数，文件名带日期', async () => {
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.find('input[aria-label="订单号"]').setValue('A001')
    const exportButton = wrapper
      .findAll('button')
      .find((node) => node.text() === '导出')
    await exportButton!.trigger('click')
    await flushPromises()
    expect(mocks.exportCsv).toHaveBeenCalledTimes(1)
    const params = mocks.exportCsv.mock.calls[0][1]
    expect(params.orderNo).toBe('A001')
    expect(params.begin).toBeUndefined()
    expect(params.step).toBeUndefined()
    expect(mocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), '订单列表-20260918.csv')
    wrapper.unmount()
  })

  it('重置清空筛选并重新查询', async () => {
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.find('input[aria-label="客户名称"]').setValue('测试客户')
    const resetButton = wrapper
      .findAll('button')
      .find((node) => node.text() === '重置')
    await resetButton!.trigger('click')
    await flushPromises()
    const lastCall = mocks.getOrders.mock.calls.at(-1)![0]
    expect(lastCall.customerName).toBeUndefined()
    expect((wrapper.find('input[aria-label="客户名称"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('历史覆盖不完整时显示提示，不把未知历史当零', async () => {
    mocks.getOrders.mockResolvedValue({
      ...pageResponse(),
      coverage: { historyComplete: false, coverageFrom: null },
    })
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    expect(wrapper.text()).toContain('历史数据覆盖不完整')
    wrapper.unmount()
  })
})
