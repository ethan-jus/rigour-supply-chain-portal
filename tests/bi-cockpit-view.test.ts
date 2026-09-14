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
const render = () =>
  mount(IndexView, {
    global: {
      plugins: [ElementPlus],
      stubs: {
        CockpitFigure: {
          name: 'CockpitFigure',
          props: ['figure'],
          template: '<div class="figure-stub">{{figure.title}}</div>',
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
  it('总览主区保留成本与回款，分析按城市商品及全国业绩切换且不重新拉取数据', async () => {
    const wrapper = render()
    await flushPromises()
    const titles = () => wrapper.findAll('.figure-stub').map((item) => item.text())
    expect(titles().slice(0, 4)).toEqual([
      '销售与回款趋势',
      '整体回款进度',
      '成本与盈亏',
      '货 · 人 · 场成本构成',
    ])
    expect(titles()).not.toContain('全国销售人员业绩排行')
    expect(titles()).toContain('城市与品类销售分布')
    const calls = mocks.overview.mock.calls.length
    await wrapper
      .findAll('[role="tab"]')
      .find((item) => item.text() === '全国销售业绩')!
      .trigger('click')
    await flushPromises()
    expect(titles()).toContain('全国销售人员业绩排行')
    expect(titles()).not.toContain('城市与品类销售分布')
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
