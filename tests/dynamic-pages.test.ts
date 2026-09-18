import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { NavigationNode } from '@/types/management'
import { listRegisteredViews, registerCustomRoutes, resolveView } from '@/utils/dynamic-pages'
import { validateNavigation } from '@/utils/route-registry'

function node(overrides: Partial<NavigationNode>): NavigationNode {
  return {
    id: 'custom-1',
    parentId: null,
    code: 'CUSTOM.1',
    type: 'PAGE',
    displayName: '自定义页面',
    permissionCode: null,
    routeKey: 'tenant.custom.page.1',
    routePath: '/supply-chain/custom/demo',
    componentPath: 'supply-chain/settings/ParameterView.vue',
    iconKey: null,
    sortOrder: 10,
    visible: true,
    keepAlive: false,
    children: [],
    ...overrides,
  }
}

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/supply-chain',
        name: 'SupplyChainConsole',
        component: { template: '<router-view />' },
        children: [
          { path: '', name: 'SupplyChainDashboard', component: { template: '<div />' } },
          { path: 'settings/menus', name: 'SupplySettingsMenus', component: { template: '<div />' } },
        ],
      },
    ],
  })
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('自定义页面组件白名单', () => {
  it('只解析已编译的 src/views 页面', () => {
    const views = listRegisteredViews()
    expect(views).toContain('supply-chain/settings/ParameterView.vue')
    expect(views.every((path) => !path.startsWith('..') && !path.startsWith('/'))).toBe(true)
    expect(resolveView('supply-chain/settings/ParameterView.vue')).toBeTypeOf('function')
    expect(resolveView('/src/views/supply-chain/settings/ParameterView.vue')).toBeTypeOf('function')
    expect(resolveView('supply-chain/settings/MissingView.vue')).toBeNull()
    expect(resolveView(null)).toBeNull()
  })
})

describe('validateNavigation 自定义页面宽松、静态路由失败关闭', () => {
  it('脏的自定义页面只跳过自身，不影响同一棵树里的静态节点', () => {
    const result = validateNavigation([
      node({ id: 'dirty', componentPath: 'supply-chain/not-compiled/NopeView.vue' }),
      node({
        id: 'static',
        componentPath: null,
        routeKey: 'supply.settings.menus',
        routePath: '/supply-chain/settings/menus',
      }),
    ])
    expect(result.map((item) => item.id)).toEqual(['static'])
  })

  it('类型或路径前缀不符的自定义页面被跳过', () => {
    expect(validateNavigation([node({ routePath: '/system-admin/evil' })])).toEqual([])
    expect(validateNavigation([node({ type: 'MENU', routePath: null })])).toEqual([])
  })

  it('合法的自定义页面保留并递归校验子节点', () => {
    const child = node({ id: 'child', children: [] })
    const result = validateNavigation([node({ id: 'parent', children: [child] })])
    expect(result).toHaveLength(1)
    expect(result[0].children.map((item) => item.id)).toEqual(['child'])
  })

  it('未注册的静态 routeKey 仍然失败关闭', () => {
    expect(() => validateNavigation([
      node({ componentPath: null, routeKey: 'system.script.injected', routePath: '/system-admin/users' }),
    ])).toThrow('未注册或路径不一致')
  })
})

describe('registerCustomRoutes', () => {
  it('在 SupplyChainConsole 下注册自定义页面并保持幂等', () => {
    const router = createTestRouter()
    registerCustomRoutes(router, [node({})])
    expect(router.hasRoute('CustomPagecustom1')).toBe(true)
    expect(router.resolve('/supply-chain/custom/demo').name).toBe('CustomPagecustom1')
    registerCustomRoutes(router, [node({})])
    expect(router.getRoutes().filter((record) => record.path === '/supply-chain/custom/demo')).toHaveLength(1)
  })

  it('组件未编译、路径非法或与静态路由冲突时只跳过并保留静态路由', () => {
    const router = createTestRouter()
    expect(() => registerCustomRoutes(router, [
      node({ id: 'a', componentPath: 'supply-chain/not-compiled/NopeView.vue' }),
      node({ id: 'b', routePath: '/system-admin/evil' }),
      node({ id: 'c', routePath: '/supply-chain/settings/menus' }),
    ])).not.toThrow()
    expect(router.hasRoute('CustomPagea')).toBe(false)
    expect(router.hasRoute('CustomPageb')).toBe(false)
    expect(router.hasRoute('CustomPagec')).toBe(false)
    expect(router.resolve('/supply-chain/settings/menus').name).toBe('SupplySettingsMenus')
  })

  it('父路由缺失时不抛错', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'Root', component: { template: '<div />' } }],
    })
    expect(() => registerCustomRoutes(router, [node({})])).not.toThrow()
    expect(router.hasRoute('CustomPagecustom1')).toBe(false)
  })
})
