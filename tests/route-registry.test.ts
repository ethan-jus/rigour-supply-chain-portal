import { describe, expect, it } from 'vitest'
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

  it('接受V2.1订单中心分组和页面路由', () => {
    expect(validateNavigation([
      node('supply.order.center.menu', null),
      node('supply.order.all', '/supply-chain/order/all'),
      node('supply.order.pending', '/supply-chain/order/pending'),
      node('supply.order.exceptions', '/supply-chain/order/exceptions'),
    ])).toHaveLength(4)
  })

  it('接受V28收付记录分组及其页面路由', () => {
    expect(validateNavigation([
      menuNode('supply.order.settlement.collections'),
      node('supply.order.settlement.receipts', '/supply-chain/order/settlement/receipts'),
      node('supply.order.settlement.payments', '/supply-chain/order/settlement/payments'),
      node('supply.order.settlement.reconciliation', '/supply-chain/order/settlement/reconciliation'),
      node('supply.order.settlement.differences', '/supply-chain/order/settlement/differences'),
    ])).toHaveLength(5)
  })

  it('拒绝V28前已废弃的收付记录页面路径', () => {
    expect(() => validateNavigation([
      node('supply.order.settlement.collections', '/supply-chain/order/settlement/collections'),
    ])).toThrow('未注册或路径不一致')
  })

  it('接受V2.1 ERP、CRM与城市运营三级路由', () => {
    expect(validateNavigation([
      node('supply.erp.master-data.menu', null),
      node('supply.erp.master-data.products', '/supply-chain/erp/master-data/products'),
      node('supply.erp.master-data.skus', '/supply-chain/erp/master-data/skus'),
      node('supply.erp.master-data.attributes.tags', '/supply-chain/erp/master-data/attributes/tags'),
      node('supply.erp.cost-settlement.menu', null),
      node('supply.erp.cost-settlement.inventory-costs', '/supply-chain/erp/cost-settlement/inventory-costs'),
      node('supply.crm.customers.areas', '/supply-chain/crm/customers/areas'),
      node('supply.crm.customers.shipping-addresses', '/supply-chain/crm/customers/shipping-addresses'),
      node('supply.crm.assignments.external-staff', '/supply-chain/crm/assignments/external-staff'),
      node('supply.crm.assignments.sales', '/supply-chain/crm/assignments/sales'),
      node('supply.city.scope.service-areas', '/supply-chain/city/scope/service-areas'),
    ])).toHaveLength(11)
  })

  it('接受ERP商品主数据下的独立SKU页面', () => {
    expect(validateNavigation([
      node('supply.erp.master-data.skus', '/supply-chain/erp/master-data/skus'),
    ])).toHaveLength(1)
  })

  it('接受独立integration pathroot与订单补充能力', () => {
    expect(validateNavigation([
      node('supply.integration.overview', '/supply-chain/integration'),
      node('supply.integration.sync-batches', '/supply-chain/integration/sync-batches'),
      node('supply.order.settlement.menu', null),
      node('supply.order.settlement.receivable', '/supply-chain/order/settlement/receivable'),
    ])).toHaveLength(4)
  })

  it('接受完整领域菜单目录中的全部分组与页面路由', () => {
    const navigation = [
      ...SUPPLY_DOMAIN_MENU_KEYS.map((routeKey) => node(routeKey, null)),
      ...SUPPLY_DOMAIN_PAGES.map((item) => node(item.routeKey, item.path)),
    ]

    expect(SUPPLY_DOMAIN_MENU_KEYS).toHaveLength(11)
    expect(SUPPLY_DOMAIN_PAGES).toHaveLength(79)
    expect(SUPPLY_DOMAIN_MENU_KEYS).not.toContain('supply.erp.warehouse.menu')
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.erp.warehouse.locations')
    expect(SUPPLY_DOMAIN_PAGES.filter((item) => item.groupTitle === '仓库管理').map((item) => item.title))
      .toEqual(['库存看板', '库存', '入库单', '出库单', '出入库流水', '库存调拨', '库存盘点', '仓库信息'])
    expect(SUPPLY_DOMAIN_PAGES.map((item) => item.routeKey))
      .not.toContain('supply.crm.customers.customer-360')
    expect(validateNavigation(navigation)).toHaveLength(90)
  })
})
