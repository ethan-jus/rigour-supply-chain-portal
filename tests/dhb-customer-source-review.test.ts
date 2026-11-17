import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import Review from '@/components/supply/DhbCustomerSourceReview.vue'
const m = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  customers: vi.fn(),
  areas: vi.fn(),
  push: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: m.push }) }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/crm-source-reviews', () => ({
  getCustomerSourceReviews: m.list,
  decideCustomerSource: m.save,
}))
vi.mock('@/api/core/crm', () => ({
  getInternalCrmCustomers: m.customers,
  getAllCrmCustomerAreas: m.areas,
}))
const row = {
  connectorId: 'c1',
  sourceId: 'SOURCE-2',
  sourceCode: 'C2',
  customerName: '门店',
  salespersonName: '李明',
  areaName: '武汉',
  issueCode: 'CUSTOMER_IDENTITY_REVIEW_REQUIRED',
  issueMessage: '同名客户待核对',
  revision: 7,
}
const setup = () =>
  mount(Review, { props: { connectorId: 'c1' }, global: { plugins: [ElementPlus] } })
beforeEach(() => {
  vi.clearAllMocks()
  m.list.mockResolvedValue([row])
  m.save.mockResolvedValue(undefined)
  m.areas.mockResolvedValue([{ code: 'WH', name: '武汉市' }])
  m.customers.mockResolvedValue({
    items: [
      {
        id: '15',
        customerCode: 'C15',
        customerName: '门店',
        statusCode: 'ACTIVE',
        dhbLinked: true,
        regionCode: 'WH',
      },
    ],
  })
})
it('进入清单按当前来源读取，展示具体业务原因和处理入口', async () => {
  const w = setup()
  await w.find('button').trigger('click')
  await flushPromises()
  expect(m.list).toHaveBeenCalledWith('c1')
  expect(w.text()).toContain('同名客户待核对')
  expect(w.text()).toContain('核对客户')
  expect(m.save).not.toHaveBeenCalled()
  w.unmount()
})
it('同名候选不自动选择；业务选择并填写说明后才保存核对结果', async () => {
  const w = setup()
  await w.find('button').trigger('click')
  await flushPromises()
  await w
    .findAll('button')
    .find((b) => b.text() === '核对客户')!
    .trigger('click')
  await flushPromises()
  expect(m.customers).toHaveBeenCalledWith(
    expect.objectContaining({
      customerName: '门店',
      statusCode: 'ACTIVE',
      dhbLinkStatus: 'LINKED',
    }),
  )
  expect(w.findComponent({ name: 'ElOption' }).props('label')).toContain('武汉市')
  let save = w.findAll('button').find((b) => b.text() === '保存核对结果')!
  expect(save.attributes('disabled')).toBeDefined()
  w.findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', '15')
  await w.find('textarea').setValue('已核对是同一门店')
  await flushPromises()
  await save.trigger('click')
  await flushPromises()
  expect(m.save).toHaveBeenCalledTimes(1)
  expect(m.save).toHaveBeenCalledWith({
    connectorId: 'c1',
    sourceId: 'SOURCE-2',
    revision: 7,
    customerId: '15',
    independent: false,
    reason: '已核对是同一门店',
  })
  expect(w.text()).toContain('系统将在后续同步时复核')
  w.unmount()
})
it('业务员和地区分别进入现有维护页面，保存失败保留业务选择', async () => {
  m.list.mockResolvedValue([
    { ...row, issueCode: 'CUSTOMER_EMPLOYEE_MAPPING_REQUIRED', issueMessage: '业务员待关联' },
    {
      ...row,
      sourceId: 'SOURCE-3',
      issueCode: 'CUSTOMER_AREA_MAPPING_REQUIRED',
      issueMessage: '归属地区待维护',
    },
  ])
  const w = setup()
  await w.find('button').trigger('click')
  await flushPromises()
  await w
    .findAll('button')
    .find((b) => b.text() === '关联业务员')!
    .trigger('click')
  await flushPromises()
  expect(m.push).toHaveBeenCalledWith('/supply-chain/hr/employees')
  expect(m.save).not.toHaveBeenCalled()
  w.unmount()
})
it('网络失败显示读取失败，不冒充暂无待完善客户', async () => {
  m.list.mockRejectedValue(new Error('network'))
  const w = setup()
  await w.find('button').trigger('click')
  await flushPromises()
  expect(w.text()).toContain('暂时无法读取')
  w.unmount()
})
