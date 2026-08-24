import { readFileSync } from 'node:fs'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
const syncDhbOrchestration = vi.hoisted(() => vi.fn())
const messages = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRoute: () => ({ meta: routeMeta }) }))
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
vi.mock('@/api', () => ({ apiClient, syncDhbOrchestration }))
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
import crmCustomerManagementSource from '@/views/supply-chain/crm/CrmCustomerManagementView.vue?raw'
import salesOrderSource from '@/views/supply-chain/order/SalesOrderView.vue?raw'
import fundDocumentSource from '@/views/supply-chain/order/FundDocumentView.vue?raw'

const globalStyleSource = readFileSync('src/assets/styles/index.scss', 'utf-8')

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
  })

  it('供应链首页展示新业务方案落地进度，不再把主流程和旧同步混在一起', () => {
    const wrapper = mount(ConsoleDashboard, { global: globalMountOptions })

    expect(wrapper.text()).toContain('新业务主流程')
    expect(wrapper.text()).toContain('主业务按我方流程展示，订货宝只作为后台同步来源')
    expect(wrapper.text()).toContain('商品管理、基础资料、供应商档案、采购订单、入库单、出库单、库存调拨、仓库信息')
    expect(wrapper.text()).toContain('订货宝订单重新同步到我方销售订单表')
    expect(wrapper.text()).not.toContain('当前没有待处理事项')
    expect(wrapper.text()).not.toContain('今日订单金额')
    expect(wrapper.find('button').exists()).toBe(false)
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
    expect(salesOrderSource).toContain('supply-page--business-main')
    expect(fundDocumentSource).toContain('supply-page--business-main')
    expect(businessDictionarySource).toContain('supply-page--business-main')

    expect(erpProductManagementSource).toContain('维护商品档案、规格价格、图片和上架状态')
    expect(erpProductSpecificationSource).toContain('商品规格')
    expect(erpProductSpecificationSource).toContain('多规格名称')
    expect(erpProductSpecificationSource).toContain('子规格名称')
    expect(erpProductSpecificationSource).toContain('getErpProductSpecifications')
    expect(erpProductSpecificationSource).not.toContain('getErpSpecifications')
    expect(crmCustomerManagementSource).toContain('客户管理')
    expect(salesOrderSource).toContain('销售订单')
    expect(fundDocumentSource).toContain('客户资金流水')
    expect(fundDocumentSource).toContain('订货宝付款单不按销售退款处理')
    expect(businessDictionarySource).toContain('维护业务使用的单位、类型、状态和支付方式')
  })

  it('ERP 单据页面按菜单拆分业务流程，不把库存调拨混入入库单流程', () => {
    expect(erpDocumentManagementSource).toContain('const workflowConfigs')
    expect(erpDocumentManagementSource).toContain('新增调拨单')
    expect(erpDocumentManagementSource).toContain('确认调拨出库')
    expect(erpDocumentManagementSource).toContain('确认调拨入库')
    expect(erpDocumentManagementSource).toContain('ERP · 库存管理')
    expect(erpDocumentManagementSource).not.toContain('ERP 单据业务流程')
  })

  it('订货宝同步中心只承载后台来源接入方案，不散成主业务页面动作', () => {
    const wrapper = mount(DhbPage, { global: globalMountOptions })

    const state = wrapper.vm as unknown as {
      activeSectionDetail: { title: string }
      boundaryRules: Array<{ label: string; value: string }>
      sections: Array<{ title: string }>
    }

    expect(wrapper.text()).toContain('订货宝同步中心')
    expect(wrapper.text()).toContain('ERP、CRM、Order 主流程不承载同步运维动作')
    expect(wrapper.text()).toContain('payload hash 跳过')
    expect(wrapper.text()).toContain('对象已存在跳过')
    expect(wrapper.text()).toContain('来源总数、Raw 落库数、目标业务表写入数分别记录')
    expect(state.activeSectionDetail.title).toBe('同步概览')
    expect(state.sections.map((section) => section.title)).toEqual([
      '同步概览',
      '映射规则',
      '运行记录',
      '异常处理',
      '图片附件',
      '对账校验',
    ])
    expect(state.boundaryRules).toContainEqual({
      label: '业务入口',
      value: 'ERP、CRM、Order 只展示我方业务表结果',
    })
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(dhbPageSource).not.toContain('/orders/dhb/sync')
    expect(dhbPageSource).not.toContain('新增连接')
    expect(dhbPageSource).not.toContain('新增映射')
    expect(dhbPageSource).not.toContain('订单镜像')
  })


  it('新业务列表展示序号列、图片列，并固定首列和最后一列', () => {
    expect(globalStyleSource).toContain('.el-table .el-table__header-wrapper')
    expect(globalStyleSource).toContain('position: sticky;')
    expect(globalStyleSource).not.toContain('td.el-table__cell:first-child')

    expect(erpProductManagementSource).toContain('class="business-table product-management-table supply-scroll-table"')
    expect(erpProductManagementSource).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
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

    expect(erpBasicDataManagementSource).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(erpBasicDataManagementSource).toMatch(/:label="`\$\{pageConfig\.shortTitle\}名称`"[^>]*show-overflow-tooltip/)
    expect(erpBasicDataManagementSource).not.toMatch(/:label="`\$\{pageConfig\.shortTitle\}名称`"[^>]*fixed="left"/)
    expect(erpBasicDataManagementSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(erpBasicDataManagementSource).toContain("{ label: '创建人'")
    expect(erpBasicDataManagementSource).toContain("{ label: '更新人'")

    expect(erpDocumentManagementSource).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(erpDocumentManagementSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(erpDocumentManagementSource).toContain('label="已入库数量"')
    expect(erpDocumentManagementSource).toContain("{ label: '创建人'")
    expect(erpDocumentManagementSource).toContain("{ label: '更新人'")

    expect(crmCustomerManagementSource).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(crmCustomerManagementSource).toMatch(/label="客户名称"[^>]*show-overflow-tooltip/)
    expect(crmCustomerManagementSource).not.toMatch(/label="客户名称"[^>]*fixed="left"/)
    expect(crmCustomerManagementSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(crmCustomerManagementSource).toContain('label="创建人"')
    expect(crmCustomerManagementSource).toContain('label="更新人"')

    expect(salesOrderSource).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(salesOrderSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(salesOrderSource).toContain('label="收款状态"')
    expect(salesOrderSource).toContain('label="客户编号"')
    expect(salesOrderSource).toContain('label="订单类型"')
    expect(salesOrderSource).toContain('label="折扣金额"')
    expect(salesOrderSource).toContain('label="商品编码"')

    expect(fundDocumentSource).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(fundDocumentSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(fundDocumentSource).toContain('label="方向"')
    expect(fundDocumentSource).toContain('label="业务类型"')
    expect(fundDocumentSource).toContain('FUND_DOCUMENT_BUSINESS_TYPE')
    expect(fundDocumentSource).toContain('FUND_DOCUMENT_STATUS')

    expect(erpProductSpecificationSource).toContain('type="index" label="序号" width="80" fixed="left" :index="tableRowIndex"')
    expect(erpProductSpecificationSource).toMatch(/label="操作"[^>]*fixed="right"/)
    expect(erpProductSpecificationSource).toContain('子规格编号')
    expect(erpProductSpecificationSource).toContain('创建人')

    expect(dhbPageSource).not.toContain('fixed="left"')
    expect(dhbPageSource).not.toContain('fixed="right"')
    expect(dhbPageSource).not.toContain('class="supply-scroll-table"')
  })
})
