import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import { seedBusinessDictionaryForTest } from '@/utils/business-dictionary'
import IndexView from '@/views/supply-chain/bi/IndexView.vue'
import type { SupplyDashboardOverview, SupplyDashboardOperatingAnalysis } from '@/api/core/bi'

const mocks = vi.hoisted(() => ({
  route: {
    fullPath: '/bi',
    meta: { dashboardSection: 'overview' },
    query: {} as Record<string, string>,
  },
  overview: vi.fn(),
  analysis: vi.fn(),
  access: vi.fn(),
  push: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: mocks.push }),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => false }) }))
vi.mock('@/stores/navigation', () => ({ useNavigationStore: () => ({ hasPath: () => true }) }))
vi.mock('@/api/core/crm', () => ({ getCrmCustomerAreas: async () => ({ items: [] }) }))
vi.mock('@/api/core/bi-comparison', () => ({
  getBiComparison: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/api/core/bi-access', () => ({ getBiEffectiveScope: mocks.access }))
vi.mock('@/api/core/bi', () => ({
  getSupplyDashboardOverview: mocks.overview,
  getSupplyDashboardOperatingAnalysis: mocks.analysis,
  getSupplyDashboardFilterOptions: async () => ({
    regions: [],
    salesOwners: [],
    customerTypes: [],
    productCategories: [],
    sourceSystems: [],
  }),
  getSupplyDashboardDataTrust: vi.fn(),
  getSupplyDashboardReconciliation: vi.fn(),
  createSupplyDashboardRefreshRun: vi.fn(),
}))
function source(amount = 100): SupplyDashboardOverview {
  return {
    from: '2026-09-01T00:00:00+08:00',
    to: '2026-09-12T23:59:59.999999+08:00',
    generatedAt: '2026-09-12T10:00:00Z',
    metrics: [{ metricCode: 'sales_amount', value: amount }],
    citySalesRanking: [],
    salesRanking: [],
    definitions: [],
    freshness: [],
  } as unknown as SupplyDashboardOverview
}
const analysis = (): SupplyDashboardOperatingAnalysis => ({
  from: source().from,
  to: source().to,
  generatedAt: source().generatedAt,
  previousFrom: '2026-08-20T00:00:00Z',
  previousTo: '2026-08-31T23:59:59.999999Z',
  previousSalesRanking: [],
  cityProducts: [],
  cityCustomers: [],
  salesReceipts: [],
})
const render = (realFigures = false, attachTo?: HTMLElement) =>
  mount(IndexView, {
    attachTo,
    global: {
      plugins: [ElementPlus],
      stubs: {
        CockpitFigure: realFigures
          ? false
          : {
              name: 'CockpitFigure',
              props: ['figure'],
              template: '<div class="figure-stub">{{figure.title}}</div>',
            },
        EchartsChart: {
          name: 'EchartsChart',
          props: ['option', 'height'],
          template: '<div class="chart-stub" />',
        },
        CityProductReport: true,
        BiOperationsWorkbench: true,
        BiReconciliationCenter: true,
        BiScopeSettings: true,
      },
    },
  })
beforeEach(() => {
  seedBusinessDictionaryForTest('COMMON', 'PRODUCT_UNIT', [{ code: 'BOX', name: '箱' }])
  vi.clearAllMocks()
  mocks.route.meta.dashboardSection = 'overview'
  mocks.route.query = { from: '2026-09-01', to: '2026-09-12' }
  mocks.overview.mockResolvedValue(source())
  mocks.analysis.mockResolvedValue(analysis())
  mocks.access.mockResolvedValue({
    accessLevel: 'TENANT',
    reasonCode: 'AUTHORIZED',
    reason: null,
    regionCodes: [],
    globalGovernance: true,
    unavailableSubjects: [],
  })
})

describe('BI页面接口筛选与异步状态', () => {
  it('分析页签控制实际面板，方向键和首尾键切换时同步焦点', async () => {
    const wrapper = render(false, document.body)
    await flushPromises()
    const tabs = wrapper.findAll('.workspace-tabs [role="tab"]')
    const panel = wrapper.get('[role="tabpanel"]')
    expect(tabs.every((tab) => tab.attributes('aria-controls') === panel.attributes('id'))).toBe(
      true,
    )
    expect(panel.find('.operating-workspace').exists()).toBe(true)
    expect(wrapper.find('.workspace-tabs .el-tabs__content').exists()).toBe(false)
    await wrapper.get('.workspace-tabs').trigger('keydown', { key: 'End' })
    await flushPromises()
    expect(tabs.at(-1)?.attributes('aria-selected')).toBe('true')
    expect(panel.attributes('aria-labelledby')).toBe(tabs.at(-1)?.attributes('id'))
    expect(document.activeElement).toBe(tabs.at(-1)?.element)
    expect(panel.text()).toContain('货 · 人 · 场成本构成')
    await wrapper.get('.workspace-tabs').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(tabs[0].attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(tabs[0].element)
    await wrapper.get('.workspace-tabs').trigger('keydown', { key: 'ArrowLeft' })
    await wrapper.get('.workspace-tabs').trigger('keydown', { key: 'Home' })
    await flushPromises()
    expect(panel.attributes('aria-labelledby')).toBe(tabs[0].attributes('id'))
    wrapper.unmount()
  })
  it('分析页签保留真实图内搜索分页，业务范围和授权变化清除缓存', async () => {
    mocks.route.meta.dashboardSection = 'sales'
    const input = source()
    input.salesRanking = Array.from({ length: 18 }, (_, i) => ({
      rankType: 'SALES',
      dimensionCode: `S${i}`,
      dimensionName: `销售${i}`,
      regionCode: 'BJ',
      regionName: '北京',
      salesAmount: 1800 - i,
      paidAmount: 900,
      unpaidAmount: 900 - i,
      orderCount: 1,
      customerCount: 1,
      rate: 50,
    }))
    mocks.overview.mockImplementation(async () => structuredClone(input))
    const wrapper = render(true)
    await flushPromises()
    const selectAnalysis = async (label: string) => {
      await wrapper
        .findAll('.workspace-tabs [role="tab"]')
        .find((tab) => tab.text() === label)!
        .trigger('click')
      await flushPromises()
    }
    const search = () => wrapper.get('.ranking-search input')
    await search().setValue('销售1')
    await wrapper.get('[aria-label="全国销售人员业绩排行下一页"]').trigger('click')
    const page = wrapper.get('.figure-page').text()
    const calls = mocks.overview.mock.calls.length
    await selectAnalysis('销售回款比较')
    await selectAnalysis('业绩监测')
    expect((search().element as HTMLInputElement).value).toBe('销售1')
    expect(wrapper.get('.figure-page').text()).toBe(page)
    expect(mocks.overview).toHaveBeenCalledTimes(calls)
    await selectAnalysis('销售回款比较')
    wrapper
      .findAllComponents({ name: 'ElSelect' })
      .find((row) => row.props('placeholder') === '全部城市')!
      .vm.$emit('update:modelValue', 'BJ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await selectAnalysis('业绩监测')
    expect((search().element as HTMLInputElement).value).toBe('')
    expect(mocks.overview).toHaveBeenLastCalledWith(expect.objectContaining({ regionCode: 'BJ' }))
    await search().setValue('销售0')
    await selectAnalysis('销售回款比较')
    mocks.access.mockResolvedValue({
      accessLevel: 'DENIED',
      reason: '范围已撤销',
      regionCodes: [],
      unavailableSubjects: [],
      globalGovernance: false,
    })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.operating-workspace').exists()).toBe(false)
    expect(wrapper.text()).toContain('范围已撤销')
    wrapper.unmount()
  })
  it('历史留存页签可直接切换箱瓶，保持业务期间且不重复请求', async () => {
    mocks.route.meta.dashboardSection = 'product-inventory'
    const input = source()
    input.inventoryItemSummary = ['BOX', 'BOTTLE'].map((unitCode, index) => ({
      categoryCode: '1',
      categoryName: '饮品',
      unitCode,
      procurementQuantity: 10,
      shippedQuantity: 2,
      remainingQuantity: 8,
      inactiveRemainingQuantity: index ? 100 : 10,
    }))
    mocks.overview.mockResolvedValue(input)
    const wrapper = render(true)
    await flushPromises()
    await wrapper
      .findAll('.workspace-tabs [role="tab"]')
      .find((tab) => tab.text() === '历史留存')!
      .trigger('click')
    await flushPromises()
    const calls = mocks.overview.mock.calls.length
    const unit = wrapper
      .findAllComponents({ name: 'ElSelect' })
      .find((select) => select.classes().includes('inventory-unit'))!
    expect(unit.props('modelValue')).toBe('BOX')
    expect(
      wrapper.findComponent({ name: 'EchartsChart' }).props('option').series[0].data[0].value,
    ).toBe(10)
    unit.vm.$emit('update:modelValue', 'BOTTLE')
    await flushPromises()
    expect(wrapper.get('.workspace-tabs [aria-selected="true"]').text()).toBe('历史留存')
    expect(
      wrapper.findComponent({ name: 'EchartsChart' }).props('option').series[0].data[0].value,
    ).toBe(100)
    expect(wrapper.get('.scope-date').text()).toBe('2026-09-01 至 2026-09-12')
    expect(mocks.overview).toHaveBeenCalledTimes(calls)
    wrapper.unmount()
  })
  it('同一快照保留成本分组，新快照不会复用旧分组或图形实例', async () => {
    const wrapper = render(true)
    await flushPromises()
    const selectAnalysis = async (label: string) => {
      await wrapper
        .findAll('.workspace-tabs [role="tab"]')
        .find((tab) => tab.text() === label)!
        .trigger('click')
      await flushPromises()
    }
    await selectAnalysis('费用构成')
    await wrapper
      .findAll('.cost-scope button')
      .find((button) => button.text() === '人')!
      .trigger('click')
    const figure = wrapper.findComponent({ name: 'CockpitFigure' })
    await selectAnalysis('经营监测')
    await selectAnalysis('费用构成')
    expect(wrapper.get('.cost-scope [aria-pressed="true"]').text()).toBe('人')
    expect(wrapper.findComponent({ name: 'CockpitFigure' }).element).toBe(figure.element)
    mocks.overview.mockResolvedValue(source(200))
    await wrapper.get('button[aria-label="刷新看板"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('.cost-scope [aria-pressed="true"]').text()).toBe('合计')
    expect(wrapper.findComponent({ name: 'CockpitFigure' }).element).not.toBe(figure.element)
    wrapper.unmount()
  })
  it('图形口径说明聚焦本图业务公式，不进入业务下钻', async () => {
    const wrapper = render()
    await flushPromises()
    const figure = wrapper.findComponent({ name: 'CockpitFigure' })
    figure.vm.$emit('explain', figure.props('figure'))
    await flushPromises()
    const drawer = wrapper
      .findAllComponents({ name: 'ElDrawer' })
      .find((item) => item.props('title') === '指标口径与数据同步')
    expect(drawer?.props('modelValue')).toBe(true)
    const guide = wrapper.findComponent({ name: 'CockpitMetricGuide' })
    expect(guide.props('focus')).toBe(`figure:${figure.props('figure').id}`)
    expect(
      guide.props('entries').some((entry: { id: string }) => entry.id === guide.props('focus')),
    ).toBe(true)
    expect(mocks.push).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('指标说明为独立按钮，点击不会触发指标的业务跳转', async () => {
    const wrapper = render()
    await flushPromises()
    const info = wrapper.get('button[aria-label="回款率口径说明"]')
    expect(info.element.parentElement?.closest('button')).toBeNull()
    await info.trigger('click')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'CockpitMetricGuide' }).props('focus')).toBe('kpi:回款率')
    expect(mocks.push).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('本人范围由后端身份补齐，不能在页面伪造其他员工', async () => {
    mocks.access.mockResolvedValue({
      accessLevel: 'SELF',
      reasonCode: 'AUTHORIZED',
      regionCodes: ['BJ'],
      ownerStaffCode: 'S1',
      defaultRegionCode: 'BJ',
      defaultOwnerStaffCode: 'S1',
      globalGovernance: false,
      unavailableSubjects: [],
    })
    const wrapper = render()
    await flushPromises()
    expect(mocks.overview).toHaveBeenCalledWith(
      expect.objectContaining({ regionCode: 'BJ', ownerStaffCode: 'S1' }),
    )
    wrapper.unmount()
    mocks.overview.mockClear()
    mocks.route.query.ownerStaffCode = 'S2'
    const denied = render()
    await flushPromises()
    expect(mocks.overview).not.toHaveBeenCalled()
    expect(denied.text()).toContain('超出账号授权范围')
    denied.unmount()
  })
  it('数据范围查询失败不会降级成全租户读取', async () => {
    mocks.access.mockRejectedValue({ code: 'SERVICE_UNAVAILABLE', message: '范围暂不可用' })
    const wrapper = render()
    await flushPromises()
    expect(mocks.overview).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('范围暂不可用')
    wrapper.unmount()
  })
  it('总览主区保留成本与回款，分析页签切换替换画布而不是向下追加图表', async () => {
    const wrapper = render()
    await flushPromises()
    const titles = () => wrapper.findAll('.figure-stub').map((item) => item.text())
    expect(titles()).toEqual(['销售与回款趋势', '成本与盈亏', '整体回款进度', '城市销售与回款'])
    expect(titles()).not.toContain('全国销售人员业绩排行')
    expect(titles()).not.toContain('城市与品类销售分布')
    const calls = mocks.overview.mock.calls.length
    await wrapper
      .findAll('[role="tab"]')
      .find((item) => item.text() === '城市与商品')!
      .trigger('click')
    await flushPromises()
    expect(titles()).toContain('城市与品类销售分布')
    expect(titles()).not.toContain('销售与回款趋势')
    await wrapper
      .findAll('[role="tab"]')
      .find((item) => item.text() === '全国销售业绩')!
      .trigger('click')
    await flushPromises()
    expect(titles()).toContain('全国销售人员业绩排行')
    expect(titles()).not.toContain('城市与品类销售分布')
    await wrapper
      .findAll('[role="tab"]')
      .find((item) => item.text() === '费用构成')!
      .trigger('click')
    await flushPromises()
    expect(titles()).toContain('货 · 人 · 场成本构成')
    await wrapper
      .findAll('[role="tab"]')
      .find((item) => item.text() === '经营监测')!
      .trigger('click')
    await flushPromises()
    expect(titles()).toContain('成本与盈亏')
    expect(mocks.overview).toHaveBeenCalledTimes(calls)
    wrapper.unmount()
  })
  it('品牌明细保留期间与城市进入销量回款报表，不跳出分析上下文', async () => {
    mocks.route.query.regionCode = 'BJ'
    const wrapper = render()
    await flushPromises()
    const figure = wrapper.findComponent({ name: 'CockpitFigure' })
    const inspectBrand = async (code: string) => {
      figure.vm.$emit('inspect', {
        title: '品牌销售',
        rows: [
          {
            key: code,
            code,
            name: '测试品牌',
            kind: 'product',
            dimension: 'BRAND',
            cells: { 销售额: '¥100.00' },
          },
        ],
      })
      await flushPromises()
      const button = wrapper
        .findAll('button')
        .find((item) => item.text() === (code === 'UNKNOWN' ? '核对商品关联' : '品牌商品'))!
      await button.trigger('click')
      await flushPromises()
    }
    await inspectBrand('123')
    expect(mocks.push).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'CityProductReport' }).props('query')).toMatchObject({
      brandId: '123',
      regionCode: 'BJ',
      from: '2026-09-01T00:00:00+08:00',
      to: '2026-09-12T23:59:59.999999+08:00',
    })
    mocks.push.mockClear()
    await inspectBrand('UNKNOWN')
    expect(mocks.push).toHaveBeenLastCalledWith({
      name: 'SupplyOrderSalesOrders',
      query: expect.objectContaining({
        dataQualityStatusCode: 'NEEDS_REVIEW',
        drillLabel: '待完善订单（含商品关联待核对，范围可能大于看板）',
        regionCode: 'BJ',
      }),
    })
    wrapper.unmount()
  })
  it('每次打开明细时默认勾选全部导出字段', async () => {
    const wrapper = render()
    await flushPromises()
    const figure = wrapper.findComponent({ name: 'CockpitFigure' })
    figure.vm.$emit('inspect', {
      title: '销售明细',
      rows: [{ key: '1', name: '张三', cells: { 销售额: '¥100.00', 客户数: '2' } }],
    })
    await flushPromises()
    const group = wrapper.findComponent({ name: 'ElCheckboxGroup' })
    expect(group.props('modelValue')).toEqual(['名称', '数据类型', '销售额', '客户数'])
    group.vm.$emit('update:modelValue', ['名称'])
    await flushPromises()
    expect(group.props('modelValue')).toEqual(['名称'])
    figure.vm.$emit('inspect', {
      title: '城市明细',
      rows: [{ key: 'BJ', name: '北京', cells: { 回款额: '¥50.00' } }],
    })
    await flushPromises()
    expect(group.props('modelValue')).toEqual(['名称', '数据类型', '回款额'])
    wrapper.unmount()
  })
  it('商品图形按真实ERP维度进入业务报表，重新打开通用报表不会残留单品筛选', async () => {
    mocks.route.query.regionCode = 'BJ'
    const wrapper = render()
    await flushPromises()
    const figure = wrapper.findComponent({ name: 'CockpitFigure' })
    for (const [dimension, field] of [
      ['CATEGORY', 'productCategoryId'],
      ['BRAND', 'brandId'],
      ['PRODUCT', 'productId'],
      ['SKU', 'skuId'],
    ]) {
      figure.vm.$emit(
        'inspect',
        {
          title: '商品分析',
          rows: [
            {
              key: '123',
              code: '123',
              name: '真实档案名称',
              kind: 'product',
              dimension,
              cells: {},
            },
          ],
        },
        '123',
      )
      await flushPromises()
      expect(wrapper.findComponent({ name: 'CityProductReport' }).props('query')).toMatchObject({
        [field]: '123',
        regionCode: 'BJ',
        from: '2026-09-01T00:00:00+08:00',
        to: '2026-09-12T23:59:59.999999+08:00',
      })
    }
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '城市商品报表')!
      .trigger('click')
    await flushPromises()
    const query = wrapper.findComponent({ name: 'CityProductReport' }).props('query')
    expect(query).toMatchObject({ regionCode: 'BJ' })
    expect(query.skuId).toBeUndefined()
    expect(query.productId).toBeUndefined()
    expect(query.brandId).toBeUndefined()
    wrapper.unmount()
  })
  it('UNKNOWN商品按日期城市销售进入待核对订单，不伪造商品或来源筛选', async () => {
    mocks.route.query.regionCode = 'BJ'
    mocks.route.query.ownerStaffCode = 'E1'
    mocks.route.query.sourceSystemCode = 'FEISHU'
    const wrapper = render()
    await flushPromises()
    wrapper.findComponent({ name: 'CockpitFigure' }).vm.$emit(
      'inspect',
      {
        title: '商品销售贡献',
        rows: [
          {
            key: 'UNKNOWN',
            code: 'UNKNOWN',
            name: '商品关联待核对',
            kind: 'product',
            dimension: 'PRODUCT',
            cells: {},
          },
        ],
      },
      'UNKNOWN',
    )
    await flushPromises()
    expect(mocks.push).toHaveBeenLastCalledWith({
      name: 'SupplyOrderSalesOrders',
      query: {
        orderDateFrom: '2026-09-01',
        orderDateTo: '2026-09-12',
        regionCode: 'BJ',
        ownerEmployeeCode: 'E1',
        dataQualityStatusCode: 'NEEDS_REVIEW',
        drillLabel: '待完善订单（含商品关联待核对，范围可能大于看板）',
      },
    })
    expect(wrapper.findComponent({ name: 'CityProductReport' }).props('modelValue')).toBe(false)
    wrapper.unmount()
  })
  it('经营目标与运营跟进入口打开可操作专题，并带入当前业务期间和城市', async () => {
    mocks.route.query.regionCode = 'BJ'
    const wrapper = render()
    await flushPromises()
    await wrapper.get('button[aria-label="经营目标"]').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'BiOperationsWorkbench' }).props()).toMatchObject({
      initialTab: 'targets',
      month: '2026-09',
      regionCode: 'BJ',
      actionSeed: null,
    })
    await wrapper.get('button[aria-label="运营跟进"]').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'BiOperationsWorkbench' }).props('initialTab')).toBe(
      'actions',
    )
    wrapper.unmount()
  })
  it('点击目标矩阵带入该城市或销售，而不是打开全租户目标', async () => {
    const wrapper = render()
    await flushPromises()
    wrapper.findComponent({ name: 'CockpitFigure' }).vm.$emit(
      'inspect',
      {
        title: '目标达成',
        rows: [
          {
            key: 'S1-paid',
            code: 'S1',
            name: '测试销售',
            kind: 'target',
            regionCode: 'BJ',
            ownerStaffCode: 'S1',
            cells: {},
          },
        ],
      },
      'S1-paid',
    )
    await flushPromises()
    expect(wrapper.findComponent({ name: 'BiOperationsWorkbench' }).props()).toMatchObject({
      initialTab: 'targets',
      regionCode: 'BJ',
      ownerStaffCode: 'S1',
      month: '2026-09',
    })
    wrapper.unmount()
  })
  it('点击城市图形直接下钻并保留日期，不先打开单行表格', async () => {
    const wrapper = render()
    await flushPromises()
    wrapper.findComponent({ name: 'CockpitFigure' }).vm.$emit(
      'inspect',
      {
        title: '城市销售',
        rows: [{ key: 'BJ', code: 'BJ', regionCode: 'BJ', kind: 'city', name: '北京', cells: {} }],
      },
      'BJ',
    )
    await flushPromises()
    expect(mocks.push).toHaveBeenLastCalledWith({
      path: '/supply-chain/bi/city-operating',
      query: expect.objectContaining({ from: '2026-09-01', to: '2026-09-12', regionCode: 'BJ' }),
    })
    expect(
      wrapper
        .findAllComponents({ name: 'ElDrawer' })
        .every((drawer) => !drawer.props('modelValue')),
    ).toBe(true)
    wrapper.unmount()
  })
  it('商品分类常驻主筛选行，查询使用所选真实分类而不依赖更多筛选', async () => {
    mocks.route.meta.dashboardSection = 'product-sales'
    const wrapper = render()
    await flushPromises()
    const category = wrapper.findComponent({ name: 'ProductCategorySelect' })
    expect(category.exists()).toBe(true)
    expect(wrapper.find('form [role="combobox"][aria-label="商品分类"]').exists()).toBe(true)
    expect(wrapper.find('.extended-filters').exists()).toBe(false)
    expect(wrapper.findAllComponents({ name: 'ProductCategorySelect' })).toHaveLength(1)
    category.vm.$emit('update:modelValue', '27')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.overview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        productCategoryId: '27',
      }),
    )
    wrapper.unmount()
  })
  it('从商品进入总览会清除不支持的分类，而不是请求全量却继续显示分类', async () => {
    mocks.route.query.productCategoryId = '7'
    const wrapper = render()
    await flushPromises()
    expect(mocks.overview.mock.calls[0][0]).toMatchObject({
      productCategoryId: undefined,
      from: '2026-09-01T00:00:00+08:00',
      to: '2026-09-12T23:59:59.999999+08:00',
    })
    expect(
      wrapper
        .findAll('.scope-tags')
        .map((row) => row.text())
        .join(),
    ).not.toContain('7')
    wrapper.unmount()
  })
  it('补充分析失败不清空已经成功的真实指标', async () => {
    mocks.analysis.mockRejectedValue(new Error('分析接口不可用'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('¥100')
    expect(wrapper.text()).toContain('当前主指标仍可查看')
    wrapper.unmount()
  })
  it('无效归属请求不退化成全租户数据', async () => {
    mocks.route.query.regionCode = 'MULTI'
    const wrapper = render()
    await flushPromises()
    expect(mocks.overview).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('城市或销售归属无效')
    wrapper.unmount()
  })
  it('切换城市后的较晚旧响应不能覆盖新范围', async () => {
    let resolveOld!: (value: SupplyDashboardOverview) => void
    mocks.overview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    const wrapper = render()
    await flushPromises()
    const select = wrapper
      .findAllComponents({ name: 'ElSelect' })
      .find((row) => row.props('placeholder') === '全部城市')!
    select.vm.$emit('update:modelValue', 'BJ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.overview.mock.calls[1][0].regionCode).toBe('BJ')
    resolveOld(source(999))
    await flushPromises()
    expect(wrapper.text()).toContain('¥100')
    expect(wrapper.text()).not.toContain('¥999')
    wrapper.unmount()
  })
})
