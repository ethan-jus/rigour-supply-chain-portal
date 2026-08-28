import { describe, expect, it } from 'vitest'
import { constantRoutes } from '@/router/routes'
import { validateNavigation } from '@/utils/route-registry'
import { SUPPLY_DOMAIN_MENU_KEYS, SUPPLY_DOMAIN_PAGES } from '@/views/supply-chain/domain/catalog'
import type { NavigationNode } from '@/types/management'

function node(routeKey: string, routePath: string | null): NavigationNode {
  return {
    id: 'navigation-id', parentId: null, code: 'NAVIGATION.CODE', type: 'PAGE',
    displayName: '导航', permissionCode: null, routeKey, routePath, iconKey: null,
    sortOrder: 10, visible: true, keepAlive: false, children: [],
  }
}

function menuNode(routeKey: string): NavigationNode {
  return { ...node(routeKey, null), type: 'MENU' }
}

describe('数据库导航注册表', () => {
  it('接受已编译且路径一致的routeKey', () => {
    expect(validateNavigation([node('system.user.list', '/system-admin/users')]))
      .toHaveLength(1)
  })

  it('接受系统菜单管理页面和无路由租户自定义分组', () => {
    expect(validateNavigation([
      node('system.menu-config.list', '/system-admin/menus'),
      menuNode('tenant.menu.group.019fdynamicgroup'),
    ])).toHaveLength(2)
  })

  it('接受系统管理人员与岗位入口', () => {
    expect(validateNavigation([
      node('system.staff.list', '/system-admin/staff'),
      node('system.position.list', '/system-admin/positions'),
    ])).toHaveLength(2)
  })

  it('租户自定义分组不能携带可执行路径', () => {
    expect(() => validateNavigation([
      { ...menuNode('tenant.menu.group.019fdynamicgroup'), routePath: '/system-admin/users' },
    ])).toThrow('未注册或路径不一致')
  })

  it('对未注册routeKey失败关闭', () => {
    expect(() => validateNavigation([node('system.script.injected', '/system-admin/users')]))
      .toThrow('未注册或路径不一致')
  })

  it('对routeKey与数据库路径不一致失败关闭', () => {
    expect(() => validateNavigation([node('system.user.list', '/platform-admin/tenants')]))
      .toThrow('未注册或路径不一致')
  })

  it('接受销售管理三级菜单的已编译路由', () => {
    expect(validateNavigation([
      node('supply.sales.attendance.today', '/supply-chain/sales/attendance/today'),
      node('supply.sales.policies.releases', '/supply-chain/sales/policies/releases'),
    ])).toHaveLength(2)
  })

  it('拒绝旧订货宝订单镜像菜单，只接受新销售订单入口', () => {
    expect(validateNavigation([
      menuNode('supply.order.menu'),
      node('supply.order.sales-orders', '/supply-chain/order/sales-orders'),
      node('supply.order.sales-payments', '/supply-chain/order/sales-payments'),
      node('supply.order.fund-documents', '/supply-chain/order/fund-documents'),
      node('supply.order.sales-refunds', '/supply-chain/order/sales-refunds'),
    ])).toHaveLength(5)

    expect(() => validateNavigation([
      node('supply.order.center.menu', null),
    ])).toThrow('未注册或路径不一致')
    expect(() => validateNavigation([
      node('supply.order.all', '/supply-chain/order/all'),
    ])).toThrow('未注册或路径不一致')
    expect(() => validateNavigation([
      node('supply.order.settlement.collections', '/supply-chain/order/settlement/collections'),
    ])).toThrow('未注册或路径不一致')
    expect(() => validateNavigation([
      node('supply.order.stock-up', '/supply-chain/order/stock-up'),
    ])).toThrow('未注册或路径不一致')
  })

  it('接受V2.1 ERP、CRM与城市运营三级路由', () => {
    expect(validateNavigation([
      node('supply.erp.master-data.menu', null),
      node('supply.erp.master-data.products', '/supply-chain/erp/master-data/products'),
      node('supply.erp.master-data.attributes.tags', '/supply-chain/erp/master-data/attributes/tags'),
      node('supply.erp.master-data.attributes.specifications', '/supply-chain/erp/master-data/attributes/specifications'),
      node('supply.erp.cost-settlement.menu', null),
      node('supply.erp.cost-settlement.inventory-costs', '/supply-chain/erp/cost-settlement/inventory-costs'),
      node('supply.crm.customers.areas', '/supply-chain/crm/customers/areas'),
      node('supply.crm.customers.shipping-addresses', '/supply-chain/crm/customers/shipping-addresses'),
      node('supply.crm.assignments.sales', '/supply-chain/crm/assignments/sales'),
      node('supply.city.scope.service-areas', '/supply-chain/city/scope/service-areas'),
    ])).toHaveLength(10)
  })

  it('接受新销售订单入口，并拒绝旧订货宝档案菜单', () => {
    expect(validateNavigation([
      node('supply.order.sales-orders', '/supply-chain/order/sales-orders'),
      node('supply.order.fund-documents', '/supply-chain/order/fund-documents'),
    ])).toHaveLength(2)

    expect(() => validateNavigation([
      menuNode('supply.integration.legacy-dhb.menu'),
    ])).toThrow('未注册或路径不一致')

    expect(() => validateNavigation([
      node('supply.integration.dhb-skus', '/supply-chain/integration/dhb-skus'),
    ])).toThrow('未注册或路径不一致')
  })

  it('接受独立订货宝同步中心入口，并拒绝分散的旧集成子页面', () => {
    expect(validateNavigation([
      menuNode('supply.integration.menu'),
      menuNode('supply.integration.sync-control.menu'),
      node('supply.integration.overview', '/supply-chain/integration'),
    ])).toHaveLength(3)

    expect(() => validateNavigation([
      node('supply.integration.connections', '/supply-chain/integration/connections'),
    ])).toThrow('未注册或路径不一致')
    expect(() => validateNavigation([
      node('supply.integration.sync-tasks', '/supply-chain/integration/sync-tasks'),
    ])).toThrow('未注册或路径不一致')
    expect(() => validateNavigation([
      node('supply.integration.retries', '/supply-chain/integration/retries-dead-letters'),
    ])).toThrow('未注册或路径不一致')
    expect(() => validateNavigation([
      node('supply.integration.field-mappings', '/supply-chain/integration/field-mappings'),
    ])).toThrow('未注册或路径不一致')
  })

  it('采购付款单使用可加载的独立业务占位页', async () => {
    const supplyRoot = constantRoutes.find((route) => route.path === '/supply-chain')
    const paymentRoute = supplyRoot?.children?.find((route) =>
      route.meta?.routeKey === 'supply.erp.procurement.payments')

    expect(paymentRoute?.path).toBe('erp/procurement/payments')
    expect(paymentRoute?.meta?.title).toBe('采购付款单')
    expect(typeof paymentRoute?.component).toBe('function')

    const componentModule = await (paymentRoute?.component as () => Promise<{ default: unknown }>)()
    expect(componentModule.default).toBeTruthy()
  })

  it('ERP商品入口使用自研商品管理页，商品规格使用独立业务页', async () => {
    const supplyRoot = constantRoutes.find((route) => route.path === '/supply-chain')
    const erpProductRoute = supplyRoot?.children?.find((route) =>
      route.meta?.routeKey === 'supply.erp.master-data.products')
    const productSpecificationRoute = supplyRoot?.children?.find((route) =>
      route.meta?.routeKey === 'supply.erp.master-data.attributes.specifications')

    expect(erpProductRoute?.path).toBe('erp/master-data/products')
    expect(erpProductRoute?.meta?.title).toBe('商品管理')
    expect(productSpecificationRoute?.path).toBe('erp/master-data/attributes/specifications')
    expect(productSpecificationRoute?.meta?.title).toBe('商品规格')

    const erpProductModule = await (erpProductRoute?.component as () => Promise<{ default: unknown }>)()
    const specificationModule = await (productSpecificationRoute?.component as () => Promise<{ default: unknown }>)()
    expect(erpProductModule.default).toBeTruthy()
    expect(specificationModule.default).toBeTruthy()
  })

  it('接受完整领域菜单目录中的全部分组与页面路由', () => {
    const navigation = [
      ...SUPPLY_DOMAIN_MENU_KEYS.map((routeKey) => node(routeKey, null)),
      ...SUPPLY_DOMAIN_PAGES.map((item) => node(item.routeKey, item.path)),
    ]

    expect(SUPPLY_DOMAIN_MENU_KEYS).toHaveLength(13)
    expect(SUPPLY_DOMAIN_PAGES).toHaveLength(79)
    expect(SUPPLY_DOMAIN_MENU_KEYS).not.toContain('supply.erp.warehouse.menu')
    expect(SUPPLY_DOMAIN_MENU_KEYS).not.toContain('supply.integration.legacy-dhb.menu')
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.erp.warehouse.locations')
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.integration.dhb-products')
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.integration.dhb-skus')
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.integration.dhb-specifications')
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.integration.sync-batches')
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.integration.external-id-mappings')
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.bi.sync-quality')
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.bi.metrics')
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.bi.dashboards')
    expect(SUPPLY_DOMAIN_PAGES.filter((item) => item.domainKey === 'bi').map((item) => item.title))
      .toEqual(['销售与回款看板', '商品销售统计', '销售毛利分析', '回款风险看板', '城市成本看板', '库存风险看板'])
    expect(SUPPLY_DOMAIN_PAGES.filter((item) => item.groupTitle === '同步控制').map((item) => item.title))
      .toEqual(['订货宝同步中心'])
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.erp.master-data.skus')
    expect(SUPPLY_DOMAIN_PAGES.filter((item) => item.groupTitle === '商品中心').map((item) => item.title))
      .toEqual(['商品管理', '商品分类', '商品品牌', '商品标签', '商品规格'])
    expect(SUPPLY_DOMAIN_PAGES.filter((item) => item.groupTitle === '库存管理').map((item) => item.title))
      .toEqual(['库存看板', '库存', '入库单', '出库单', '出入库流水', '库存调拨', '库存盘点', '仓库信息'])
    expect(SUPPLY_DOMAIN_PAGES.filter((item) => item.groupTitle === '采购管理').map((item) => item.title))
      .toEqual(['采购申请', '采购订单', '到货与入库', '采购退货', '采购付款单'])
    expect(SUPPLY_DOMAIN_PAGES.filter((item) => item.groupTitle === '客户管理').map((item) => item.title))
      .toEqual(['客户档案', '客户地址', '门店档案', '客户类型', '归属地区'])
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.crm.customers.customer-360')
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.crm.assignments.external-staff')
    expect(validateNavigation(navigation)).toHaveLength(92)
  })

  it('接受已实现的供应链 BI 子看板路由', () => {
    expect(validateNavigation([
      menuNode('supply.bi.menu'),
      node('supply.bi.index', '/supply-chain/bi'),
      node('supply.bi.sales-collection', '/supply-chain/bi/sales-collection'),
      node('supply.bi.product-sales', '/supply-chain/bi/product-sales'),
      node('supply.bi.gross-profit', '/supply-chain/bi/gross-profit'),
      node('supply.bi.payment-risk', '/supply-chain/bi/payment-risk'),
      node('supply.bi.city-cost', '/supply-chain/bi/city-cost'),
      node('supply.bi.inventory-risk', '/supply-chain/bi/inventory-risk'),
    ])).toHaveLength(8)

    expect(() => validateNavigation([
      node('supply.bi.sync-quality', '/supply-chain/bi/sync-quality'),
    ])).toThrow('未注册或路径不一致')
  })
})
