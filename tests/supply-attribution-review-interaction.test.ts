import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import Dialog from '@/views/supply-chain/order/components/OrderAttributionReviewDialog.vue'
import {
  attributionReviewApi,
  type AttributionReviewContext,
  type AttributionAdjustment,
} from '@/api/core/order-attribution-review'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
vi.mock('@/api/core/order-attribution-review', () => ({
  attributionReviewApi: { context: vi.fn(), propose: vi.fn(), decide: vi.fn() },
}))
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
async function render() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useSupplyAuthorizationStore().context = {
    initialized: true,
    canInitialize: false,
    mode: 'ACTIVE',
    version: 9,
    permissions,
  }
  wrapper = mount(Dialog, {
    props: { modelValue: true, orderId: '123' },
    attachTo: document.body,
    global: { plugins: [pinia, ElementPlus], stubs: { teleport: true } },
  })
  await flushPromises()
}
const button = (label: string) => wrapper.findAll('button').find((b) => b.text() === label)!
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
  await button('提交复核申请').trigger('click')
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
  await button('审核通过并生效').trigger('click')
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
