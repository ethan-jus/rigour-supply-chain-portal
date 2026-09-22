import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus, { ElMessage, ElSelect } from 'element-plus'

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
    expect(wrapper.text()).toContain('收款金额')
    expect(wrapper.text()).toContain('待收金额')
    expect(wrapper.text()).toContain('已核金额')
    wrapper.unmount()
  })

  it('金额和回款率取全部筛选汇总，移除已核金额统计', async () => {
    const page = pageResponse()
    mocks.getOrders.mockResolvedValue({ ...page, totals: {
      originalAmount: 400, payableAmount: 350, discountAmount: 50, discountRate: 0.125,
      paidAmount: 120, unpaidAmount: 230, checkedAmount: 20, customerCount: 7,
    } })
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const summary = wrapper.find('[aria-label="金额统计"]').text()
    expect(summary).not.toContain('已核金额')
    for (const text of ['订货金额', '¥400.00', '订单金额', '¥350.00', '优惠额', '¥50.00', '优惠率', '12.50%', '回款金额', '回款率', '34.29%', '¥120.00', '待收金额', '¥230.00']) {
      expect(summary).toContain(text)
    }
    expect(summary).not.toContain('¥900.00')
    const last = wrapper.findAll('.order-summary__metric').at(-1)!
    expect(last.text()).toContain('客户数')
    expect(last.text()).toContain('7')
    wrapper.unmount()
  })

  it('缺明细时不显示虚假的订货金额和优惠率', async () => {
    mocks.getOrders.mockResolvedValue({ ...pageResponse(), totals: {
      missingLineOrderCount: 2, payableAmount: 100, paidAmount: 20, unpaidAmount: 80, checkedAmount: 0,
    } })
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    expect(wrapper.text()).toContain('2 笔订单缺少明细')
    expect(wrapper.find('[aria-label="金额统计"]').text()).not.toContain('NaN')
    expect(wrapper.findAll('.order-summary__metric--discount .order-summary__value').map(item => item.text())).toEqual(['-', '-'])
    expect(wrapper.find('[aria-label="金额统计"]').text()).toContain('回款率20.00%')
    wrapper.unmount()
  })

  it('优惠条件和三种金额排序传到后端及导出，清空恢复全部', async () => {
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const discount = wrapper.findAllComponents(ElSelect).find(item => item.props('ariaLabel') === '优惠情况')!
    discount.vm.$emit('update:modelValue', 'true')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getOrders.mock.calls.at(-1)![0].hasDiscount).toBe(true)
    for (const prop of ['payableAmount', 'discountAmount', 'discountRate']) {
      wrapper.findAllComponents({ name: 'ElTable' })[0]!.vm.$emit('sort-change', { prop, order: 'descending' })
      await flushPromises()
      expect(mocks.getOrders.mock.calls.at(-1)![0]).toMatchObject({ hasDiscount: true, sortBy: prop, sortDirection: 'desc', begin: 0 })
    }
    await wrapper.findAll('button').find(button => button.text() === '导出')!.trigger('click')
    await flushPromises()
    expect(mocks.exportCsv).toHaveBeenLastCalledWith('orders', expect.objectContaining({ hasDiscount: true, sortBy: 'discountRate', sortDirection: 'desc' }))
    discount.vm.$emit('update:modelValue', 'false')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getOrders.mock.calls.at(-1)![0].hasDiscount).toBe(false)
    discount.vm.$emit('update:modelValue', undefined)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getOrders.mock.calls.at(-1)![0].hasDiscount).toBeUndefined()
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

  it('订货宝关联条件清空后不变成未关联查询', async () => {
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const linked = wrapper.findAllComponents(ElSelect).find(item => item.props('ariaLabel') === '订货宝关联单')!
    linked.vm.$emit('update:modelValue', 'true')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getOrders.mock.calls.at(-1)![0].dhbLinked).toBe(true)
    linked.vm.$emit('update:modelValue', undefined)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getOrders.mock.calls.at(-1)![0].dhbLinked).toBeUndefined()
    wrapper.unmount()
  })

  it('清空输入后再查询，旧条件不再带上', async () => {
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const customer = wrapper.find('input[aria-label="客户名称"]')
    await customer.setValue('测试客户')
    await customer.trigger('keyup.enter')
    await flushPromises()
    expect(mocks.getOrders.mock.calls.at(-1)![0]).toMatchObject({ customerName: '测试客户' })

    // 删除输入内容（查询框为空）后再查询：必须真的不带这个条件
    await customer.setValue('')
    await customer.trigger('keyup.enter')
    await flushPromises()
    expect(mocks.getOrders.mock.calls.at(-1)![0].customerName).toBeUndefined()

    // 空白字符同样视为未填写
    await customer.setValue('   ')
    await customer.trigger('keyup.enter')
    await flushPromises()
    expect(mocks.getOrders.mock.calls.at(-1)![0].customerName).toBeUndefined()
    wrapper.unmount()
  })

  it('订货宝单号支持查询、清空后重新查询', async () => {
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const input = wrapper.find('input[aria-label="订货宝单号"]')
    await input.setValue('  20260920.0988  ')
    await input.trigger('keyup.enter')
    await flushPromises()
    expect(mocks.getOrders.mock.calls.at(-1)![0].dhbOrderNo).toBe('20260920.0988')
    await input.setValue('')
    await input.trigger('keyup.enter')
    await flushPromises()
    expect(mocks.getOrders.mock.calls.at(-1)![0].dhbOrderNo).toBeUndefined()
    wrapper.unmount()
  })

  it('导出与查询同筛选，不带分页参数，文件名带日期', async () => {
    const wrapper = mount(OrderListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await wrapper.find('input[aria-label="订单号"]').setValue('A001')
    await wrapper.find('input[aria-label="订货宝单号"]').setValue('0988')
    const exportButton = wrapper
      .findAll('button')
      .find((node) => node.text() === '导出')
    await exportButton!.trigger('click')
    await flushPromises()
    expect(mocks.exportCsv).toHaveBeenCalledTimes(1)
    const params = mocks.exportCsv.mock.calls[0][1]
    expect(params.orderNo).toBe('A001')
    expect(params.dhbOrderNo).toBe('0988')
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
    expect(wrapper.find('input[placeholder="下单开始日期"]').exists()).toBe(true)
    expect(wrapper.find('input[placeholder="下单结束日期"]').exists()).toBe(true)
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
