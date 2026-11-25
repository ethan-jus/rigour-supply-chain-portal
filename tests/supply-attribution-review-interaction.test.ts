import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import Dialog from '@/views/supply-chain/order/components/OrderAttributionReviewDialog.vue'
import OrderDetail from '@/views/supply-chain/order/components/OrderRegisterDetailDrawer.vue'
import { getRegisterOrderDetail } from '@/api/core/order-sales'
import { orderLifecycleEvents } from '@/api/core/order-history-sync'
import { getOrderRegisterPayments } from '@/api/core/order-register'
import { useAuthStore } from '@/stores/auth'
import {
  attributionReviewApi,
  type AttributionReviewContext,
  type AttributionAdjustment,
} from '@/api/core/order-attribution-review'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
vi.mock('@/api/core/order-attribution-review', () => ({
  attributionReviewApi: { context: vi.fn(), propose: vi.fn(), decide: vi.fn() },
}))
vi.mock('@/api/core/order-sales', () => ({ getRegisterOrderDetail: vi.fn() }))
vi.mock('@/api/core/order-history-sync', () => ({ orderLifecycleEvents: vi.fn().mockResolvedValue([]) }))
vi.mock('@/api/core/order-register', () => ({ getOrderRegisterPayments: vi.fn().mockResolvedValue({ items: [] }) }))
let wrapper: VueWrapper
let context: AttributionReviewContext
const permissions = [
  'order:attribution:read',
  'order:attribution:propose',
  'order:attribution:approve',
]
const adjustment = (): AttributionAdjustment => ({
  id: 'review1',
  status: 'PENDING',
  expectedOrderRevision: 7,
  expectedSnapshotRevision: 0,
  before: context.current,
  proposed: {
    employeeCode: 'EMP-OLD',
    employeeName: '历史张三',
    departmentId: null,
    departmentName: null,
    departmentPath: [],
    regionCode: null,
    regionPath: [],
  },
  evidenceRef: '原单档案 123',
  evidenceText: '原单业务员映射证据；无历史部门证据',
  reason: '历史归属核对',
  proposedBy: 'author',
  proposedAt: '2026-09-15 10:00:00',
  reviewedBy: null,
  reviewedAt: null,
  reviewReason: null,
})
function authorize(grants = permissions) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSupplyAuthorizationStore().context = {
    initialized: true,
    canInitialize: false,
    mode: 'ACTIVE',
    version: 9,
    permissions: grants,
  }
  return pinia
}
async function render(grants = permissions) {
  const pinia = authorize(grants)
  wrapper = mount(Dialog, {
    props: { modelValue: true, orderId: '123' },
    attachTo: document.body,
    global: { plugins: [pinia, ElementPlus], stubs: { teleport: true } },
  })
  await flushPromises()
}
const button = (label: string) => wrapper.findAll('button.el-button').find((b) => b.text() === label)!
const field = (label: string) =>
  wrapper
    .findAll('.el-form-item')
    .find((f) => f.find('.el-form-item__label').text().includes(label))!
beforeEach(() => {
  vi.clearAllMocks()
  context = {
    orderId: '123',
    orderNo: 'DD123',
    sourceSystemCode: 'FEISHU',
    sourceOrderNo: 'SOURCE123',
    orderRevision: 7,
    snapshotRevision: 0,
    current: {
      order: { owner_employee_code: 'UNMAPPED', owner_employee_name_snapshot: '原始姓名' },
      snapshot: {},
    },
    adjustments: [],
  }
  vi.mocked(attributionReviewApi.context).mockImplementation(async () => context)
  vi.spyOn(ElMessage, 'success').mockImplementation(() => ({ close: vi.fn() }))
  vi.spyOn(ElMessage, 'warning').mockImplementation(() => ({ close: vi.fn() }))
  vi.spyOn(ElMessageBox, 'prompt').mockResolvedValue({
    value: '已核对归档原单证据',
    action: 'confirm',
  } as Awaited<ReturnType<typeof ElMessageBox.prompt>>)
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
it('提交时绑定当前版本，未知历史部门和地区保持为空，提交后重新读取申请', async () => {
  vi.mocked(attributionReviewApi.propose).mockImplementation(async () => {
    const item = adjustment()
    context = { ...context, adjustments: [item] }
    return item
  })
  await render()
  await wrapper.get('.el-collapse-item__header').trigger('click')
  await flushPromises()
  await field('HR 员工编码').get('input').setValue('EMP-OLD')
  await field('历史员工姓名').get('input').setValue('历史张三')
  await field('来源证据位置').get('input').setValue('原单档案 123')
  await field('历史归属证据说明').get('textarea').setValue('原单业务员映射证据；无历史部门证据')
  await field('更正原因').get('input').setValue('历史归属核对')
  await button('申请更正').trigger('click')
  await flushPromises()
  expect(attributionReviewApi.propose).toHaveBeenCalledWith(
    '123',
    expect.objectContaining({
      orderRevision: 7,
      snapshotRevision: 0,
      proposed: expect.objectContaining({
        employeeCode: 'EMP-OLD',
        departmentId: null,
        departmentPath: [],
        regionCode: null,
        regionPath: [],
      }),
    }),
  )
  expect(attributionReviewApi.context).toHaveBeenCalledTimes(2)
  expect(wrapper.text()).toContain('待复核')
})
it('审核只提交申请编号和意见，成功后读取生效记录并通知订单列表刷新', async () => {
  context.adjustments = [adjustment()]
  vi.mocked(attributionReviewApi.decide).mockImplementation(async () => {
    const applied = {
      ...adjustment(),
      status: 'APPLIED' as const,
      reviewedAt: '2026-09-15 11:00:00',
      reviewReason: '已核对归档原单证据',
    }
    context = { ...context, orderRevision: 8, snapshotRevision: 1, adjustments: [applied] }
    return applied
  })
  await render()
  await button('审核更正').trigger('click')
  await flushPromises()
  expect(attributionReviewApi.decide).toHaveBeenCalledWith(
    '123',
    'review1',
    true,
    '已核对归档原单证据',
  )
  expect(wrapper.text()).toContain('已生效')
  expect(wrapper.emitted('applied')).toHaveLength(1)
  expect(attributionReviewApi.context).toHaveBeenCalledTimes(2)
})

it('只读角色可查申请，缺少申请或审核权限时收起对应操作', async () => {
  context.adjustments = [adjustment()]
  await render(['order:attribution:read'])
  expect(wrapper.text()).toContain('待复核')
  for (const label of ['申请更正', '审核更正', '驳回']) expect(button(label)).toBeUndefined()
})

it('申请人不能审核自己的申请', async () => {
  context.adjustments = [adjustment()]
  await render()
  useAuthStore().user = { id: 'author', principalScope: 'TENANT', username: 'owner', displayName: '申请人', roles: [], permissions, tenantId: null, tenantName: null }
  await flushPromises()
  expect(button('审核更正')).toBeUndefined()
  expect(button('驳回')).toBeUndefined()
})

it('订单详情只对有查看权的角色开放，点击后读取当前订单的申请', async () => {
  const pinia = authorize([])
  vi.mocked(getRegisterOrderDetail, { partial: true }).mockResolvedValue({ id: '123', orderNo: 'DD123', lines: [] })
  vi.mocked(orderLifecycleEvents).mockResolvedValue([])
  vi.mocked(getOrderRegisterPayments, { partial: true }).mockResolvedValue({ items: [] })
  wrapper = mount(OrderDetail, {
    props: { modelValue: true, orderId: '123' },
    global: { plugins: [pinia, ElementPlus], stubs: { teleport: true, PaymentDetailDrawer: true, SalesLogisticsPanel: true, OrderInvoicePanel: true } },
  })
  await flushPromises()
  expect(button('归属更正')).toBeUndefined()
  useSupplyAuthorizationStore().context!.permissions = ['order:attribution:read']
  await flushPromises()
  expect(attributionReviewApi.context).not.toHaveBeenCalled()
  await button('归属更正').trigger('click')
  await flushPromises()
  expect(attributionReviewApi.context).toHaveBeenCalledWith('123')
})
