import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus, { ElMessage } from 'element-plus'

const mocks = vi.hoisted(() => ({
  getOrders: vi.fn(),
  exportCsv: vi.fn(),
  getCreators: vi.fn(),
  getInvoice: vi.fn(),
  getProfiles: vi.fn(),
  applyInvoice: vi.fn(),
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
  getOrderInvoice: mocks.getInvoice,
  getOrderInvoiceProfiles: mocks.getProfiles,
  applyOrderInvoice: mocks.applyInvoice,
}))
vi.mock('@/api/core/crm', () => ({ getAllCrmCustomerAreas: mocks.getAllAreas }))
vi.mock('@/api/core/hr', () => ({
  getHrEmployees: mocks.getEmployees,
  hrOrganizationApi: { departments: mocks.getDepartments },
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
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
        dataQualityStatusCode: 'COMPLETE',
        invoiceStatusCode: null,
        invoiceStatusName: null,
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
    mocks.getInvoice.mockResolvedValue(null)
    mocks.getProfiles.mockResolvedValue([])
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
    expect(lastCall).toMatchObject({ customerName: '测试客户', begin: 0, includeSubDepartments: true })
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

  it('历史覆盖不完整时以可关闭提示告知，不把未知历史当零', async () => {
    const warning = vi.spyOn(ElMessage, 'warning')
    mocks.getOrders.mockResolvedValue({
      ...pageResponse(),
      coverage: { historyComplete: false, coverageFrom: null },
    })
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    expect(warning).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('历史数据覆盖不完整'),
        showClose: true,
      }),
    )
    warning.mockRestore()
    wrapper.unmount()
  })

  it('查询条件默认全部展示在同一行，按钮固定在右侧', async () => {
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const actions = wrapper
      .findAll('.order-register-filter__actions button')
      .map((node) => node.text())
    expect(actions).toEqual(['重置', '查询', '导出', '列设置', '同步订单'])
    // 不再使用折叠行，全部条件在条件行内按宽度自然换行。
    expect(wrapper.find('.order-register-filter__line--extra').exists()).toBe(false)
    expect(wrapper.find('.order-register-filter__fields').text()).toContain('创建人')
    const dateEditor = wrapper.find('.order-register-filter__fields .el-date-editor')
    expect(dateEditor.exists()).toBe(true)
    expect(dateEditor.attributes('style') || '').toContain('width: 230px')
    wrapper.unmount()
  })

  it('操作列用按钮样式展示明细、回款与发票', async () => {
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const actionButtons = wrapper
      .findAll('.order-register-table button')
      .filter((node) => ['明细', '回款', '发票'].includes(node.text()))
    expect(actionButtons.map((node) => node.text())).toEqual(['明细', '回款', '发票'])
    expect(actionButtons.every((node) => node.classes().includes('el-button--small'))).toBe(true)
    expect(actionButtons.every((node) => !node.classes().includes('is-link'))).toBe(true)
    wrapper.unmount()
  })

  it('回款入口只在有回款记录时出现', async () => {
    const base = pageResponse()
    mocks.getOrders.mockResolvedValue({
      ...base,
      items: [
        { ...base.items[0], id: '1', orderNo: 'A001', paidAmount: 200 },
        { ...base.items[0], id: '2', orderNo: 'A002', paidAmount: 0 },
      ],
    })

    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    const payButtons = wrapper
      .findAll('.order-register-table button')
      .filter((node) => node.text() === '回款')
    expect(payButtons).toHaveLength(1)
    wrapper.unmount()
  })

  it('发票入口所有状态可见；已申请点击跳转发票管理页并带订单号', async () => {
    const base = pageResponse()
    mocks.getOrders.mockResolvedValue({
      ...base,
      items: [
        { ...base.items[0], id: '1', orderNo: 'A001', invoiceStatusCode: null, invoiceStatusName: null, paidAmount: 0 },
        { ...base.items[0], id: '2', orderNo: 'A002', invoiceStatusCode: 'PENDING', invoiceStatusName: '待开票', paidAmount: 0 },
        { ...base.items[0], id: '3', orderNo: 'A003', invoiceStatusCode: 'INVOICED', invoiceStatusName: '已开票', paidAmount: 0 },
        { ...base.items[0], id: '4', orderNo: 'A004', invoiceStatusCode: 'REVOKED', invoiceStatusName: '已撤回', paidAmount: 0 },
      ],
    })

    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    // 文案统一"发票"；用按钮变体区分：申请（未申请/已撤回）与查看（待开票/已开票）
    const applyButtons = wrapper.findAll(
      '.order-register-table button.order-action--invoice-apply',
    )
    const viewButtons = wrapper.findAll('.order-register-table button.order-action--invoice-view')
    expect(applyButtons).toHaveLength(2)
    expect(viewButtons).toHaveLength(2)
    expect(applyButtons.every((node) => node.text() === '发票')).toBe(true)
    expect(viewButtons.every((node) => node.text() === '发票')).toBe(true)

    await viewButtons[0]!.trigger('click')
    await flushPromises()
    expect(mocks.push).toHaveBeenCalledWith({
      path: '/supply-chain/order/invoices',
      query: { orderNo: 'A002' },
    })
    wrapper.unmount()
  })

  it('点击发票直接打开申请开票弹窗，不进入订单详情', async () => {
    const wrapper = mount(OrderListView, {
      global: { plugins: [ElementPlus] },
      attachTo: document.body,
    })
    await flushPromises()

    const invoiceButton = wrapper.find('.order-register-table button.order-action--invoice-apply')
    expect(invoiceButton.exists()).toBe(true)
    await invoiceButton.trigger('click')
    await flushPromises()

    expect(mocks.getInvoice).toHaveBeenCalledWith('A001')
    expect(document.body.textContent).toContain('申请开票')
    expect(document.body.textContent).toContain('发票抬头')
    // 详情抽屉不应被打开（抽屉专属页签文案不出现）
    expect(document.body.textContent).not.toContain('来源与审计')
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('订单状态显示中文，待完善单据不显示原始编码', async () => {
    const base = pageResponse()
    const draft = { ...base.items[0], id: '2', orderStatusCode: 'DRAFT', paymentStatusCode: 'PAID' }
    const completion = {
      ...base.items[0],
      id: '3',
      orderStatusCode: 'DRAFT',
      dataQualityStatusCode: 'NEEDS_REVIEW',
    }
    mocks.getOrders.mockResolvedValue({ ...base, items: [draft, completion] })

    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    const text = wrapper.find('.order-register-table').text()
    expect(text).toContain('草稿')
    expect(text).toContain('待完善')
    expect(text).not.toContain('DRAFT')
    expect(text).not.toContain('NEEDS_REVIEW')
    wrapper.unmount()
  })
})
