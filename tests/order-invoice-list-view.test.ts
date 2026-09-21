import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  can: vi.fn(() => true),
  routeQuery: { value: {} as Record<string, string> },
}))

vi.mock('@/api/core/order-register', () => ({
  getOrderInvoicePage: mocks.page,
}))

vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: mocks.can }),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn() }),
    useRoute: () => ({ query: mocks.routeQuery.value }),
  }
})

import InvoiceManagementView from '@/views/supply-chain/order/InvoiceManagementView.vue'

function pageView() {
  return {
    page: {
      total: 2,
      begin: 0,
      step: 20,
      items: [
        {
          id: '11',
          orderId: '1',
          orderNo: 'A001',
          customerName: '测试客户',
          title: '杭州测试有限公司',
          invoiceTypeName: '普通发票',
          amount: 1000,
          statusCode: 'PENDING',
          statusName: '待开票',
          appliedBy: '张三',
          appliedAt: '2026-09-20T02:00:00Z',
          invoiceNo: null,
          invoicedAt: null,
          attachmentCount: 0,
        },
        {
          id: '12',
          orderId: '2',
          orderNo: 'A002',
          customerName: '另一客户',
          title: '上海另一有限公司',
          invoiceTypeName: '专用发票',
          amount: 2000,
          statusCode: 'INVOICED',
          statusName: '已开票',
          appliedBy: '李四',
          appliedAt: '2026-09-19T02:00:00Z',
          invoiceNo: 'INV-0002',
          invoicedAt: '2026-09-20T02:00:00Z',
          attachmentCount: 1,
        },
      ],
    },
    statusCounts: { PENDING: 1, INVOICED: 1 },
  }
}

function mountView() {
  return mount(InvoiceManagementView, {
    global: { plugins: [ElementPlus] },
  })
}

describe('发票管理页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.can.mockReturnValue(true)
    mocks.page.mockResolvedValue(pageView())
    mocks.routeQuery.value = {}
  })

  it('从订单列表直达时按订单号预填筛选', async () => {
    mocks.routeQuery.value = { orderNo: 'A001' }
    mountView()
    await flushPromises()

    expect(mocks.page).toHaveBeenCalledWith(expect.objectContaining({ orderNo: 'A001' }))
  })

  it('按状态徽标和列表渲染；有写权限时待开票行显示办理', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(mocks.page).toHaveBeenCalledWith(
      expect.objectContaining({ begin: 0, step: 20 }),
    )
    expect(wrapper.text()).toContain('待开票 1')
    expect(wrapper.text()).toContain('已开票 1')
    expect(wrapper.text()).toContain('INV-0002')

    const actionButtons = wrapper.findAll('button').filter((button) => button.text() === '办理')
    expect(actionButtons).toHaveLength(1)
  })

  it('无写权限时只显示查看入口', async () => {
    mocks.can.mockReturnValue(false)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('button').filter((button) => button.text() === '办理')).toHaveLength(0)
    expect(wrapper.findAll('button').filter((button) => button.text() === '查看').length).toBeGreaterThan(0)
  })
})
