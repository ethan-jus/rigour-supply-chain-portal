import { readFileSync } from 'node:fs'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { useNavigationStore } from '@/stores/navigation'

const routeMeta = vi.hoisted(() => ({
  applicationCode: 'SUPPLY_CHAIN',
  pageKey: 'dhb-sync-center',
  title: '订货宝同步中心',
}))
const authState = vi.hoisted(() => ({
  permissions: new Set<string>(),
  user: {
    displayName: '测试用户',
    principalScope: 'PLATFORM',
    tenantId: 'tenant-1',
  },
}))
const businessSettingsApi = vi.hoisted(() => ({
  createBizDict: vi.fn(),
  createBizDictItem: vi.fn(),
  getBizDictItems: vi.fn(),
  getBizDicts: vi.fn(),
  updateBizDict: vi.fn(),
  updateBizDictItem: vi.fn(),
}))
const apiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))
const getDhbOpenIssues = vi.hoisted(() => vi.fn())
const getDhbSyncTasks = vi.hoisted(() => vi.fn())
const createDhbManualResolution = vi.hoisted(() => vi.fn())
const replayDhbOrderObject = vi.hoisted(() => vi.fn())
const queryDhbWarehousingReceipts = vi.hoisted(() => vi.fn())
const syncDhbOrchestration = vi.hoisted(() => vi.fn())
const messages = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('vue-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-router')>(), useRoute: () => ({ meta: routeMeta }) }))
vi.mock('@/stores', () => ({
  useAuthStore: () => ({
    user: authState.user,
    hasPermission: (permission: string) => authState.permissions.has(permission),
  }),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: authState.user,
    hasPermission: (permission: string) => authState.permissions.has(permission),
  }),
}))
vi.mock('@/api/core/business-settings', () => businessSettingsApi)
vi.mock('@/api', () => ({
  apiClient,
  createDhbManualResolution,
  getDhbOpenIssues,
  getDhbSyncTasks,
  queryDhbWarehousingReceipts,
  replayDhbOrderObject,
  syncDhbOrchestration,
}))
vi.mock('element-plus', () => ({ ElMessage: messages }))

import ConsoleDashboard from '@/components/console/ConsoleDashboard.vue'
import DhbPage from '@/views/supply-chain/dhb/DhbPage.vue'
import BusinessDictionaryView from '@/views/supply-chain/settings/BusinessDictionaryView.vue'
import dhbPageSource from '@/views/supply-chain/dhb/DhbPage.vue?raw'
import businessDictionarySource from '@/views/supply-chain/settings/BusinessDictionaryView.vue?raw'
import erpProductManagementSource from '@/views/supply-chain/erp/ErpProductManagementView.vue?raw'
import erpProductSpecificationSource from '@/views/supply-chain/erp/ErpProductSpecificationView.vue?raw'
import erpBasicDataManagementSource from '@/views/supply-chain/erp/ErpBasicDataManagementView.vue?raw'
import erpDocumentManagementSource from '@/views/supply-chain/erp/ErpDocumentManagementView.vue?raw'
import erpInventoryBalanceSource from '@/views/supply-chain/erp/ErpInventoryBalanceView.vue?raw'
import crmCustomerManagementSource from '@/views/supply-chain/crm/CrmCustomerManagementView.vue?raw'
import crmCustomerDictionarySource from '@/views/supply-chain/crm/CrmCustomerDictionaryView.vue?raw'
import crmShippingAddressSource from '@/views/supply-chain/crm/CrmShippingAddressView.vue?raw'
import salesOrderSource from '@/views/supply-chain/order/SalesOrderView.vue?raw'
import fundDocumentSource from '@/views/supply-chain/order/FundDocumentView.vue?raw'
import salesShipmentSource from '@/views/supply-chain/order/SalesShipmentView.vue?raw'
import salesPaymentRecordSource from '@/views/supply-chain/order/SalesPaymentRecordView.vue?raw'
import salesRefundRecordSource from '@/views/supply-chain/order/SalesRefundRecordView.vue?raw'
import biDashboardSource from '@/views/supply-chain/bi/IndexView.vue?raw'

const globalStyleSource = readFileSync('src/assets/styles/index.scss', 'utf-8')
const supplyChainStyleSource = readFileSync('src/assets/styles/_supply-chain.scss', 'utf-8')
const erpDocumentsApiSource = readFileSync('src/api/core/erp-documents.ts', 'utf-8')
const orderSalesApiSource = readFileSync('src/api/core/order-sales.ts', 'utf-8')
const biApiSource = readFileSync('src/api/core/bi.ts', 'utf-8')
const biChartSource = readFileSync('src/views/supply-chain/bi/components/EchartsChart.vue', 'utf-8')

const passthrough = defineComponent({ template: '<div><slot name="header" /><slot name="footer" /><slot /></div>' })
const emptyStub = defineComponent({ template: '<span />' })

const globalMountOptions = {
  directives: { loading: () => {} },
  stubs: {
    ElAlert: passthrough,
    ElButton: passthrough,
    ElCard: passthrough,
    ElCheckbox: emptyStub,
    ElCol: passthrough,
    ElDatePicker: emptyStub,
    ElDialog: passthrough,
    ElDivider: passthrough,
    ElDrawer: passthrough,
    ElEmpty: emptyStub,
    ElForm: passthrough,
    ElFormItem: passthrough,
    ElInput: emptyStub,
    ElInputNumber: emptyStub,
    ElOption: emptyStub,
    ElRow: passthrough,
    ElSelect: passthrough,
    ElStep: emptyStub,
    ElSteps: passthrough,
    ElSwitch: emptyStub,
    ElTabPane: passthrough,
    ElTable: passthrough,
    ElTableColumn: emptyStub,
    ElTabs: passthrough,
    ElTag: passthrough,
  },
}

describe('合同驱动的供应链页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.permissions.clear()
    routeMeta.applicationCode = 'SUPPLY_CHAIN'
    routeMeta.pageKey = 'dhb-sync-center'
    routeMeta.title = '订货宝同步中心'
    businessSettingsApi.getBizDicts.mockResolvedValue([])
    businessSettingsApi.getBizDictItems.mockResolvedValue([])
    getDhbOpenIssues.mockResolvedValue([])
    getDhbSyncTasks.mockResolvedValue([])
    createDhbManualResolution.mockResolvedValue({})
    replayDhbOrderObject.mockResolvedValue({ status: 'SUCCEEDED' })
    queryDhbWarehousingReceipts.mockResolvedValue({ total: 0, items: [] })
  })

  it('供应链首页仅展示当前应用已授权导航，不展示开发计划或虚构统计', () => {
    const pinia = createPinia()
    const navigation = useNavigationStore(pinia)
    navigation.loadedApplications = ['SUPPLY_CHAIN']
    navigation.navigationByApplication.SUPPLY_CHAIN = [{
      id: 'orders', parentId: null, code: 'orders', type: 'PAGE', displayName: '销售订单',
      permissionCode: 'order:read', routeKey: 'supply.order.sales-orders',
      routePath: '/supply-chain/order/sales-orders', iconKey: 'order', sortOrder: 0,
      visible: true, keepAlive: true, children: [],
    }]
    const wrapper = mount(ConsoleDashboard, { global: {
      ...globalMountOptions,
      plugins: [pinia],
      stubs: { ...globalMountOptions.stubs, ElIcon: passthrough, RouterLink: {
        props: ['to'], template: '<a :href="to"><slot /></a>',
      } },
    } })

    expect(wrapper.get('nav').text()).toContain('销售订单')
    expect(wrapper.get('a').attributes('href')).toBe('/supply-chain/order/sales-orders')
    expect(wrapper.text()).not.toMatch(/新业务主流程|当前落地范围|业务新表|下一步|未接入/)
    expect(wrapper.text()).not.toContain('当前没有待处理事项')
    expect(wrapper.text()).not.toContain('今日订单金额')
    expect(apiClient.get).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('数据字典只按新字典表契约查询，不再暴露模块和作用域筛选', async () => {
    const wrapper = mount(BusinessDictionaryView, { global: globalMountOptions })
    await flushPromises()

    expect(businessSettingsApi.getBizDicts).toHaveBeenCalledWith({
      dictionaryCode: undefined,
    })
    expect(wrapper.text()).not.toContain('快速查找')
    expect('visibleDictionaries' in wrapper.vm).toBe(false)
    expect('keyword' in (wrapper.vm as unknown as { filters: Record<string, unknown> }).filters).toBe(false)
  })

  it('ERP/CRM/Order/数据字典主流程页面使用统一业务页面骨架', () => {
    expect(erpProductManagementSource).toContain('supply-page--business-main')
    expect(erpProductSpecificationSource).toContain('supply-page--business-main')
    expect(erpBasicDataManagementSource).toContain('supply-page--business-main')
    expect(erpDocumentManagementSource).toContain('supply-page--business-main')
    expect(crmCustomerManagementSource).toContain('supply-page--business-main')
    expect(crmShippingAddressSource).toContain('supply-page--business-main')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('supply-page--business-main')
    expect(fundDocumentSource).toContain('supply-page--business-main')
    expect(businessDictionarySource).toContain('supply-page--business-main')

    expect(erpProductManagementSource).toContain('维护商品档案、规格价格、图片和上架状态')
    expect(erpProductSpecificationSource).toContain('商品规格')
    expect(erpProductSpecificationSource).toContain('多规格名称')
    expect(erpProductSpecificationSource).toContain('子规格名称')
    expect(erpProductSpecificationSource).toContain('getErpProductSpecifications')
    expect(erpProductSpecificationSource).not.toContain('getErpSpecifications')
    expect(crmCustomerManagementSource).toContain('客户管理')
    expect(crmShippingAddressSource).toContain('客户地址')
    expect(crmShippingAddressSource).toContain('getCrmShippingAddresses')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('销售订单')
    expect(fundDocumentSource).toContain('客户资金流水')
    expect(fundDocumentSource).toContain('按收支明细口径查看客户资金来源、关联单据、支付流水和账户信息')
    expect(businessDictionarySource).toContain('维护业务使用的单位、类型、状态和支付方式')
  })

  it('ERP 单据页面按菜单拆分业务流程，不把库存调拨混入入库单流程', () => {
    expect(erpDocumentManagementSource).toContain('const workflowConfigs')
    expect(erpDocumentManagementSource).toContain('新增调拨单')
    expect(erpDocumentManagementSource).toContain('确认调拨出库')
    expect(erpDocumentManagementSource).toContain('确认调拨入库')
    expect(erpDocumentManagementSource).toContain('ERP · 库存管理')
    expect(erpDocumentManagementSource).toContain('@submit.prevent="searchRows"')
    expect(erpDocumentManagementSource).toContain('stockInTypeCode: empty(filters.stockInTypeCode)')
    expect(erpDocumentManagementSource).toContain('stockInTimeFrom: from')
    expect(erpDocumentManagementSource).toContain('stockInTimeTo: to')
    expect(erpDocumentManagementSource).toContain('warehouseId: empty(filters.warehouseId)')
    expect(erpDocumentManagementSource).toContain('supplierId: empty(filters.supplierId)')
    expect(erpDocumentManagementSource).toContain('sourceWarehouseId: empty(filters.sourceWarehouseId)')
    expect(erpDocumentManagementSource).toContain('targetWarehouseId: empty(filters.targetWarehouseId)')
    expect(erpDocumentManagementSource).not.toContain('ERP 单据业务流程')
  })

  it('CRM 客户管理查询显式提交当前筛选条件', () => {
    const submitSearch = crmCustomerManagementSource.match(/function submitSearch\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''

    expect(crmCustomerManagementSource).toContain('@submit.prevent="submitSearch"')
    expect(crmCustomerManagementSource).toContain('@click="submitSearch"')
    expect(submitSearch).toContain('currentPage.value = 1')
    expect(submitSearch).toContain('void loadCustomers()')
    expect(crmCustomerManagementSource).toContain('customerTypeCode: empty(filters.customerTypeCode)')
    expect(crmCustomerManagementSource).toContain('regionCode: empty(filters.regionCode)')
    expect(crmCustomerManagementSource).toContain('ownerEmployeeCode: empty(filters.ownerEmployeeCode)')
    expect(crmCustomerManagementSource).toContain('statusCode: empty(filters.statusCode)')
  })

  it('订货宝同步中心按单一业务对象提供按钮并保留异常工作台', async () => {
    const wrapper=mount(DhbPage,{global:globalMountOptions})
    await flushPromises()
    const buttons=wrapper.findAllComponents({name:'DhbPageSyncButton'})
    expect(buttons.map(b=>b.props('scope'))).toContain('SALES_ORDER')
    expect(buttons.map(b=>b.props('scope'))).toContain('RECEIPT')
    expect(buttons.map(b=>b.props('scope'))).toContain('CUSTOMER')
    expect(buttons.every(b=>b.props('scope') && b.props('scope')!=='ALL')).toBe(true)
    expect(wrapper.text()).toContain('OPEN 异常按统一规则处理')
    expect(wrapper.text()).toContain('各业务页面分别同步对应对象')
    expect(getDhbOpenIssues).toHaveBeenCalledWith(500)
    expect(syncDhbOrchestration).not.toHaveBeenCalled()
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(dhbPageSource).not.toContain('runUnifiedSync')
  })

  it('BI 专题通过驾驶舱呈现，明细和数据治理按需打开', () => {
    expect(biDashboardSource).toContain('CockpitWorkspace')
    expect(biDashboardSource).toContain('workspace-navigation')
    expect(biDashboardSource).toContain('核心经营指标')
    expect(biDashboardSource).toContain('getSupplyDashboardOverview')
    expect(biDashboardSource).toContain('getSupplyDashboardReconciliation')
    expect(biDashboardSource).toContain('inspectFigure')
    expect(biDashboardSource).toContain('scopeQuery')
    expect(biDashboardSource).toContain('样例')
    expect(biDashboardSource).not.toContain('dashboard-data-trust-strip')
    expect(biDashboardSource).not.toContain('角色运营工作台')
    expect(biDashboardSource).not.toContain('overview-supply-chain-map')
    expect(biApiSource).toContain('ownerStaffCode?: string')
    expect(biApiSource).not.toContain('ownerEmployeeCode?: string')
    expect(biChartSource).toContain('HeatmapChart')
    expect(biChartSource).toContain('LineChart')
    expect(biChartSource).not.toContain('ScatterChart')
    expect(biChartSource).not.toContain('SunburstChart')
  })


  it('新业务列表展示序号列、图片列，并固定首列和最后一列', () => {
    expect(globalStyleSource).toContain('.el-table .el-table__header-wrapper')
    expect(globalStyleSource).toContain('position: sticky;')
    expect(globalStyleSource).not.toContain('td.el-table__cell:first-child')

    expect(erpProductManagementSource).toContain('class="business-table product-management-table supply-scroll-table"')
    expect(erpProductManagementSource.replace(/\s+/g, ' ')).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(erpProductManagementSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(erpProductManagementSource).toContain('label="商品图片"')
    expect(erpProductManagementSource).toContain('scope.row.mainImageUrl')
    expect(erpProductManagementSource).toContain('<el-table-column label="商品名称" min-width="260">')
    expect(erpProductManagementSource).not.toMatch(/label="商品名称"[^>]*fixed="left"/)
    expect(erpProductManagementSource).toContain('label="推荐商品"')
    expect(erpProductManagementSource).toContain('label="起订量"')
    expect(erpProductManagementSource).toContain('label="整倍订货量"')
    expect(erpProductManagementSource).toContain('label="限购量"')
    expect(erpProductManagementSource).toContain('label="创建人"')

    expect(erpBasicDataManagementSource.replace(/\s+/g, ' ')).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(erpBasicDataManagementSource).toMatch(/:label="`\$\{pageConfig\.shortTitle\}名称`"[^>]*show-overflow-tooltip/)
    expect(erpBasicDataManagementSource).not.toMatch(/:label="`\$\{pageConfig\.shortTitle\}名称`"[^>]*fixed="left"/)
    expect(erpBasicDataManagementSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(erpBasicDataManagementSource).toContain("{ label: '创建人'")
    expect(erpBasicDataManagementSource).toContain("{ label: '更新人'")

    expect(erpDocumentManagementSource.replace(/\s+/g, ' ')).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(erpDocumentManagementSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(erpDocumentManagementSource).toContain('label="已入库数量"')
    expect(erpDocumentManagementSource).toContain('function isExternalSource')
    expect(erpDocumentManagementSource).toContain('if (isExternalSource(row)) return false')
    expect(erpDocumentManagementSource).toContain("{ label: '来源系统'")
    expect(erpDocumentManagementSource).toContain("{ label: '来源单号'")
    expect(erpDocumentManagementSource).toContain("{ label: '创建人'")
    expect(erpDocumentManagementSource).toContain("{ label: '更新人'")
    expect(erpDocumentsApiSource).toContain('sourceSystemCode: string | null')
    expect(erpDocumentsApiSource).toContain('sourceDocumentNo: string | null')

    expect(crmCustomerManagementSource.replace(/\s+/g, ' ')).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(crmCustomerManagementSource).toMatch(/label="客户名称"[^>]*show-overflow-tooltip/)
    expect(crmCustomerManagementSource).not.toMatch(/label="客户名称"[^>]*fixed="left"/)
    expect(crmCustomerManagementSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(crmCustomerManagementSource).toContain('label="创建人"')
    expect(crmCustomerManagementSource).toContain('label="更新人"')
    expect(crmShippingAddressSource.replace(/\s+/g, ' ')).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(crmShippingAddressSource).toMatch(/label="客户名称"[^>]*show-overflow-tooltip/)
    expect(crmShippingAddressSource).not.toMatch(/label="客户名称"[^>]*fixed="left"/)
    expect(crmShippingAddressSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(crmShippingAddressSource).toContain('label="详细地址"')

    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(salesOrderSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('function isExternalSource')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('function isFeishuSource')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('if (isExternalSource(row) && !isFeishuSource(row)) return false')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('label="来源状态"')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('DHB_ORDER_STATUS')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('sourceStatusCode: empty(filters.sourceStatusCode)')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('label="收款状态"')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('label="发货状态"')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('SALES_SHIPMENT_STATUS')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('prop="customerCodeSnapshot" label="客户编号"')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('客户名称')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('<span>订单类型</span>')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('label="折扣金额"')
    expect(salesOrderSource.replace(/\s+/g, ' ')).toContain('label="商品编码"')
    expect(orderSalesApiSource).toContain('sourceSystemCode: string | null')
    expect(orderSalesApiSource).toContain('sourceOrderNo: string | null')
    expect(orderSalesApiSource).toContain('sourceStatusCode?: string')
    expect(orderSalesApiSource).toContain('sourceStatusCode: string | null')
    expect(orderSalesApiSource).toContain('shipmentStatusCode: string | null')

    expect(fundDocumentSource.replace(/\s+/g, ' ')).toContain('type=\"index\" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(fundDocumentSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(fundDocumentSource).toContain('label="收付款单号"')
    expect(fundDocumentSource).toContain('label="关联单号"')
    expect(fundDocumentSource).toContain('label="支付流水号"')
    expect(fundDocumentSource).toContain('label="收入"')
    expect(fundDocumentSource).toContain('label="支出"')
    expect(fundDocumentSource).toContain('label="收支类型"')
    expect(fundDocumentSource).toContain('收款账号')
    expect(fundDocumentSource).toContain('label="开户名称"')
    expect(fundDocumentSource).toContain('label="开户银行"')
    expect(fundDocumentSource).toContain('label="附件"')
    expect(fundDocumentSource).toContain('attachmentItems')
    expect(fundDocumentSource).toContain('仅来源引用')
    expect(fundDocumentSource).toContain('sourceDocumentNo')
    expect(fundDocumentSource).toContain('sourceOrderNo')
    expect(fundDocumentSource).toContain('paymentSerialNo')
    expect(fundDocumentSource).toContain('bankAccountNo')
    expect(orderSalesApiSource).toContain('attachments: FundDocumentAttachment[]')
    expect(fundDocumentSource).toContain('FUND_DOCUMENT_BUSINESS_TYPE')
    expect(fundDocumentSource).toContain('FUND_DOCUMENT_STATUS')

    expect(erpProductSpecificationSource.replace(/\s+/g, ' ')).toContain('type=\"index\" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(erpProductSpecificationSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(erpProductSpecificationSource).toContain('子规格编号')
    expect(erpProductSpecificationSource).toContain('创建人')

    expect(dhbPageSource).not.toContain('fixed="left"')
    expect(dhbPageSource).not.toContain('fixed="right"')
    expect(dhbPageSource).not.toContain('class="supply-scroll-table"')
  })

  it('供应链业务列表名称列不再使用单字头像和名称下方编码', () => {
    const businessListSources = [
      erpBasicDataManagementSource,
      erpInventoryBalanceSource,
      erpProductSpecificationSource,
      crmCustomerManagementSource,
      crmCustomerDictionarySource,
      crmShippingAddressSource,
      fundDocumentSource,
      salesShipmentSource,
      salesPaymentRecordSource,
      salesRefundRecordSource,
    ]

    for (const source of businessListSources) {
      expect(source).not.toContain('record-avatar')
      expect(source).not.toContain('record-identity-content')
    }
    expect(supplyChainStyleSource).not.toContain('.record-avatar')
    expect(crmShippingAddressSource).not.toContain('<small>{{ scope.row.customerCode')
    expect(fundDocumentSource).not.toContain('counterpartyCodeSnapshot || scope.row.customerCodeSnapshot')
  })
})
