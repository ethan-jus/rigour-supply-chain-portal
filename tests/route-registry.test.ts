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

  it('接受V2.1 ERP、CRM与城市运营三级路由', () => {
    expect(validateNavigation([
      node('supply.erp.master-data.menu', null),
      node('supply.erp.master-data.products', '/supply-chain/erp/master-data/products'),
      node('supply.crm.assignments.sales', '/supply-chain/crm/assignments/sales'),
      node('supply.city.scope.service-areas', '/supply-chain/city/scope/service-areas'),
    ])).toHaveLength(4)
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

    expect(SUPPLY_DOMAIN_MENU_KEYS).toHaveLength(12)
    expect(SUPPLY_DOMAIN_PAGES).toHaveLength(78)
    expect(validateNavigation(navigation)).toHaveLength(90)
  })
})
