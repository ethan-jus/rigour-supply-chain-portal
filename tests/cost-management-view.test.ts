import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import { businessPageLabels } from '@/utils/business-page-labels'
import CostManagementView from '@/views/supply-chain/cost/CostManagementView.vue'
import {
  getCosts,
  getCostCities,
  getCostEmployees,
  getCostWarehouses,
  exportCosts,
  type CostPage,
} from '@/api/core/cost'
const state = vi.hoisted(() => ({
  permissions: new Set<string>(),
  route: { path: '/supply-chain/cost/logistics' },
}))
vi.mock('vue-router', () => ({
  onBeforeRouteLeave: vi.fn(),
  onBeforeRouteUpdate: vi.fn(),
  useRoute: () => state.route,
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: (permission: string) => state.permissions.has(permission) }),
}))
vi.mock('@/api/core/cost', () => ({
  getCosts: vi.fn(),
  getCostCities: vi.fn(),
  getCostEmployees: vi.fn(),
  getCostWarehouses: vi.fn(),
  getCostSources: vi.fn(),
  getCostHistory: vi.fn(),
  saveCost: vi.fn(),
  changeCostStatus: vi.fn(),
  exportCosts: vi.fn(),
}))
const exported = vi.hoisted(() => vi.fn())
vi.mock('@/views/supply-chain/cost/cost-export', () => ({ exportCostRows: exported }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn().mockResolvedValue(undefined),
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value,
  businessDictionaryOptions: (_module: string, code: string) =>
    code === 'MARKETING_EXPENSE_TYPE'
      ? [
          { value: 'PROMOTION', label: '推广活动' },
          { value: 'ADVERTISING', label: '广告费' },
          { value: 'ENDORSEMENT', label: '代言费' },
          { value: 'PERSONNEL_COST', label: '人员成本' },
          { value: 'COMMISSION', label: '佣金提成' },
        ]
      : [],
}))
let wrapper: VueWrapper | undefined
const empty: CostPage = {
  total: 0,
  begin: 0,
  step: 20,
  items: [],
  confirmedAmount: 0,
  paidAmount: 0,
  pendingCount: 0,
}
beforeEach(() => {
  vi.clearAllMocks()
  state.route = reactive({ path: '/supply-chain/cost/logistics' })
  state.permissions = new Set(['order:logistics-cost:read'])
  vi.mocked(getCosts).mockResolvedValue(empty)
  vi.mocked(getCostCities).mockResolvedValue([])
  vi.mocked(getCostEmployees).mockResolvedValue([])
  vi.mocked(getCostWarehouses).mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
async function render(advanced = true, exportDialog = false) {
  wrapper = mount(CostManagementView, {
    global: {
      plugins: [ElementPlus, createPinia()],
      stubs: {
        SupplyPageTitle: true,
        ElDialog: exportDialog
          ? {
              props: ['modelValue'],
              template: '<section v-if="modelValue"><slot/><slot name="footer"/></section>',
            }
          : true,
        ElDrawer: {
          name: 'ElDrawer',
          props: ['modelValue', 'title'],
          template: '<section><slot v-if="modelValue" /></section>',
        },
        CostAttachments: true,
      },
    },
  })
  await flushPromises()
  const more = wrapper.findAll('button').find((button) => button.text() === '更多筛选')
  if (more && advanced) await more.trigger('click')
}
describe('cost management workflow', () => {
  it.each(['losses', 'office-rentals', 'marketing'])(
    '%s 自定义导出自选字段及勾选范围，重新查询清除勾选',
    async (category) => {
      state.route.path = '/supply-chain/cost/' + category
      const prefix =
        'erp:cost:' +
        (category === 'losses' ? 'loss' : category === 'marketing' ? 'marketing' : 'rental')
      state.permissions = new Set([prefix + ':read', prefix + ':export'])
      const items = ['C001', 'C002'].map((id) => ({
        id,
        documentNo: id,
        categoryCode: category,
        statusCode: 'CONFIRMED',
        sources: [],
        data: { amount: 0, costDate: '2026-11-06', title: '业务费用', paymentStatusCode: 'UNPAID' },
      })) as unknown as import('@/api/core/cost').CostRecord[]
      vi.mocked(getCosts).mockResolvedValue({ ...empty, total: 2, items })
      vi.mocked(exportCosts).mockResolvedValue({ ...empty, total: 2, items })
      await render(false, true)
      const body = wrapper!
        .findAll('.el-table__body-wrapper tbody tr')
        .find((r) => r.text().includes('C002'))!
      await body.get('input[type="checkbox"]').setValue(true)
      const button = (name: string) => wrapper!.findAll('button').find((b) => b.text() === name)!
      await button('自定义导出').trigger('click')
      await flushPromises()
      expect(wrapper!.find('.export-scope').text()).toContain('已勾选的 1 条记录')
      const columns = wrapper!.findAll('.export-fields .el-checkbox')
      for (const column of columns)
        if (!['费用单号', '金额'].includes(column.text())) await column.get('input').setValue(false)
      await button('开始导出').trigger('click')
      await flushPromises()
      expect(exported).toHaveBeenLastCalledWith(
        expect.any(String),
        ['费用单号', '金额'],
        [['C002', 0]],
      )
      await wrapper!.get('.supply-list-filters__form').trigger('submit')
      await flushPromises()
      await button('自定义导出').trigger('click')
      await flushPromises()
      expect(wrapper!.find('.export-scope').text()).toContain('全部筛选结果（2 条）')
    },
  )
  it.each(['losses', 'office-rentals', 'marketing'])(
    '所有成本类别按相同状态限制操作：%s',
    async (category) => {
      state.route.path = '/supply-chain/cost/' + category
      const prefix =
        'erp:cost:' +
        (category === 'losses' ? 'loss' : category === 'office-rentals' ? 'rental' : 'marketing')
      state.permissions = new Set(
        ['read', 'write', 'confirm', 'void'].map((action) => prefix + ':' + action),
      )
      vi.mocked(getCosts).mockResolvedValue({
        ...empty,
        total: 3,
        items: ['DRAFT', 'CONFIRMED', 'VOID'].map((statusCode) => ({
          id: statusCode,
          documentNo: statusCode,
          statusCode,
          revision: 1,
          categoryCode: 'MARKETING',
          data: {
            requestId: 'flow-' + statusCode,
            revision: null,
            typeCode: null,
            departmentId: null,
            ownerEmployeeCode: null,
            logistics: null,
            rental: null,
            remark: '',
            reason: '',
            title: '费用',
            amount: 10,
            costDate: '2026-11-05',
            cityCode: 'C1',
            cityName: '武汉',
            paymentStatusCode: 'UNPAID',
          },
          sources: [],
          warehouseName: null,
          ownerEmployeeName: null,
          createdTime: '',
          updatedTime: '',
        })),
      } as CostPage)
      await render(false)
      const rows = wrapper!.findAll('tr.el-table__row')
      expect(
        rows.map((row) => row.findAll('.cost-row-actions button').map((button) => button.text())),
      ).toEqual([
        ['查看', '编辑', '确认', '作废'],
        ['查看', '撤销'],
        ['查看', '删除'],
      ])
    },
  )

  it.each([
    'purchases',
    'losses',
    'logistics',
    'warehouse-rentals',
    'office-rentals',
    'marketing',
    'expenses',
  ])('opens every record state from 查看 with read-only access in %s', async (category) => {
    state.route.path =
      category === 'expenses' ? '/supply-chain/hr/expenses' : '/supply-chain/cost/' + category
    vi.mocked(getCosts).mockResolvedValue({
      ...empty,
      total: 3,
      items: ['DRAFT', 'CONFIRMED', 'VOID'].map((statusCode, index) => ({
        id: String(index),
        documentNo: 'CST-' + statusCode,
        statusCode,
        revision: 1,
        categoryCode: 'LOGISTICS',
        data: {
          requestId: 'view-' + index,
          revision: null,
          typeCode: null,
          departmentId: null,
          ownerEmployeeCode: null,
          paymentStatusCode: 'UNPAID',
          logistics: null,
          rental: null,
          remark: '',
          reason: '',
          title: '模拟费用',
          cityCode: 'C1',
          cityName: '武汉',
          costDate: '2026-10-01',
          amount: 35,
        },
        sources: [],
        warehouseName: null,
        ownerEmployeeName: null,
        createdTime: '2026-10-01T01:00:00Z',
        updatedTime: '2026-10-01T01:00:00Z',
      })),
    } as CostPage)
    await render(false)
    const buttons = wrapper!.findAll('button').filter((button) => button.text() === '查看')
    expect(buttons).toHaveLength(3)
    expect(
      wrapper!.findAll('button').some((button) => ['编辑', '确认', '作废'].includes(button.text())),
    ).toBe(false)
    for (let index = 0; index < buttons.length; index++) {
      await buttons[index]!.trigger('click')
      const drawer = wrapper!
        .findAllComponents({ name: 'ElDrawer' })
        .find(
          (component) => component.props('title') === businessPageLabels[state.route.path] + '详情',
        )!
      expect(drawer.props('modelValue')).toBe(true)
      if (category === 'purchases' || category === 'losses') {
        const specification = drawer
          .findAll('.business-detail-fields > div')
          .find((field) => field.find('dt').text() === '规格')
        expect(specification?.find('dd').text()).toBe('-')
        expect(drawer.text()).not.toContain(category === 'purchases' ? '损耗原因' : '进货单价')
      }
    }
  })
  it.each(['PERSONNEL_COST', 'COMMISSION'])(
    'filters marketing costs by the new dictionary type %s',
    async (typeCode) => {
      state.route.path = '/supply-chain/cost/marketing'
      state.permissions = new Set(['erp:cost:marketing:read'])
      await render(false)
      const typeSelect = wrapper!
        .findAllComponents({ name: 'CostDictSelect' })
        .find((select) => select.props('code') === 'MARKETING_EXPENSE_TYPE')!
      typeSelect.vm.$emit('update:modelValue', typeCode)
      await wrapper!.get('.supply-list-filters form').trigger('submit')
      await flushPromises()
      expect(getCosts).toHaveBeenLastCalledWith(
        'marketing',
        expect.objectContaining({ typeCode, begin: 0 }),
      )
      expect(
        wrapper!
          .findAllComponents({ name: 'CostDictSelect' })
          .some((select) => select.props('code') === 'MARKETING_EXPENSE_TYPE'),
      ).toBe(true)
    },
  )
  it('营销按事项和实际负责人筛选，类型仍保留业务入口', async () => {
    state.route.path = '/supply-chain/cost/marketing'
    state.permissions = new Set(['erp:cost:marketing:read'])
    await render(false)
    expect(wrapper!.find('input[aria-label="费用事项"]').exists()).toBe(true)
    expect(wrapper!.find('input[aria-label="手填经办人"]').exists()).toBe(false)
    wrapper!
      .findAllComponents({ name: 'CostDictSelect' })
      .find((select) => select.props('code') === 'MARKETING_EXPENSE_TYPE')!
      .vm.$emit('update:modelValue', 'PROMOTION')
    await wrapper!.get('input[aria-label="费用事项"]').setValue('门店活动')
    wrapper!
      .findAllComponents({ name: 'ElSelect' })
      .find((select) => select.props('ariaLabel') === '费用负责人筛选')!
      .vm.$emit('update:modelValue', 'E1')
    await wrapper!.get('.supply-list-filters form').trigger('submit')
    expect(getCosts).toHaveBeenLastCalledWith(
      'marketing',
      expect.objectContaining({
        title: '门店活动',
        ownerEmployeeCode: 'E1',
        typeCode: 'PROMOTION',
      }),
    )
  })
  it.each(['warehouse-rentals', 'office-rentals'])(
    'uses month as the primary rental filter for %s',
    async (category) => {
      state.route.path = '/supply-chain/cost/' + category
      await render(false)
      expect(
        wrapper!
          .findAllComponents({ name: 'ElDatePicker' })
          .some((picker) => picker.props('type') === 'month'),
      ).toBe(true)
      expect(wrapper!.find('input[aria-label="费用开始日期"]').exists()).toBe(false)
      expect(wrapper!.find('input[aria-label="场地名称筛选"]').exists()).toBe(true)
      expect(wrapper!.find('input[aria-label="租赁合同编号"]').exists()).toBe(true)
      expect(wrapper!.findAll('button').some((button) => button.text() === '更多筛选')).toBe(false)
    },
  )
  it('does not show unknown aggregate values as zero or a currency-prefixed missing amount', async () => {
    await render(false)
    expect(wrapper!.get('.cost-summary').text()).not.toContain('¥待补金额')
    expect(wrapper!.get('.summary-registered strong').text()).toBe('-')
  })
  it('loads the Order list and keeps mutation controls hidden for read-only access', async () => {
    await render()
    expect(getCosts).toHaveBeenCalledWith(
      'logistics',
      expect.objectContaining({ begin: 0, step: 20 }),
    )
    expect(wrapper!.findAll('button').some((button) => /新增/.test(button.text()))).toBe(false)
  })
  it.each(['expenses', 'marketing', 'warehouse-rentals', 'logistics'] as const)(
    '费用筛选仅提交对应业务的独立条件 %s',
    async (category) => {
      state.route.path =
        category === 'expenses' ? '/supply-chain/hr/expenses' : `/supply-chain/cost/${category}`
      await render()
      await wrapper!.get('input[aria-label="费用单号"]').setValue(' DOC-1 ')
      const field =
        category === 'warehouse-rentals'
          ? ['场地名称筛选', 'objectName', '北京仓']
          : category === 'logistics'
            ? ['运单号', 'trackingNo', 'WAY-1']
            : ['费用事项', 'title', '差旅']
      await wrapper!.get(`input[aria-label="${field[0]}"]`).setValue(field[2])
      await wrapper!.get('.supply-list-filters form').trigger('submit')
      await flushPromises()
      expect(getCosts).toHaveBeenLastCalledWith(category, {
        documentNo: 'DOC-1',
        [field[1]]: field[2],
        begin: 0,
        step: 20,
      })
      for (const label of ['备注', '来源系统', '关键词'])
        expect(wrapper!.find(`input[aria-label="${label}"]`).exists()).toBe(false)
      await wrapper!
        .findAll('button')
        .find((button) => button.text() === '重置')!
        .trigger('click')
      await flushPromises()
      expect(getCosts).toHaveBeenLastCalledWith(category, { begin: 0, step: 20 })
    },
  )
  it('keeps applied filters during pagination and does not double query after resetting the page', async () => {
    vi.mocked(getCosts).mockResolvedValue({ ...empty, total: 45 })
    await render()
    await wrapper!.get('input[aria-label="运单号"]').setValue('未提交')
    await wrapper!.get('.el-pagination .btn-next').trigger('click')
    await flushPromises()
    expect(getCosts).toHaveBeenLastCalledWith('logistics', { begin: 20, step: 20 })
    vi.mocked(getCosts).mockClear()
    await wrapper!.get('.supply-list-filters form').trigger('submit')
    await flushPromises()
    expect(getCosts).toHaveBeenCalledTimes(1)
    expect(getCosts).toHaveBeenLastCalledWith('logistics', {
      begin: 0,
      step: 20,
      trackingNo: '未提交',
    })
  })
  it('does not carry logistics-only filters to a different cost category', async () => {
    await render()
    await wrapper!.get('input[aria-label="运单号"]').setValue('WAY-1')
    await wrapper!.get('.supply-list-filters form').trigger('submit')
    await flushPromises()
    expect(getCosts).toHaveBeenLastCalledWith(
      'logistics',
      expect.objectContaining({ trackingNo: 'WAY-1' }),
    )
    state.route.path = '/supply-chain/cost/warehouse-rentals'
    await flushPromises()
    expect(getCosts).toHaveBeenLastCalledWith('warehouse-rentals', { begin: 0, step: 20 })
    expect(wrapper!.find('input[aria-label="运单号"]').exists()).toBe(false)
    await wrapper!.get('input[aria-label="租赁合同编号"]').setValue('LEASE-1')
    await wrapper!.get('.supply-list-filters form').trigger('submit')
    await flushPromises()
    expect(getCosts).toHaveBeenLastCalledWith('warehouse-rentals', {
      begin: 0,
      step: 20,
      contractNo: 'LEASE-1',
    })
  })
  it('shows query failures as errors and clears stale records', async () => {
    vi.mocked(getCosts).mockRejectedValue(new Error('费用查询服务不可用'))
    await render()
    expect(wrapper!.text()).toContain('费用查询服务不可用')
  })
  it('discards the old category response after switching to marketing', async () => {
    let resolveOld!: (value: CostPage) => void
    vi.mocked(getCosts).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    await render()
    state.route.path = '/supply-chain/cost/marketing'
    await flushPromises()
    resolveOld({ ...empty, total: 123 })
    await flushPromises()
    expect(getCosts).toHaveBeenLastCalledWith('marketing', expect.anything())
    expect(wrapper!.findComponent({ name: 'ElPagination' }).props('total')).toBe(0)
  })
})
