import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NavigationNode } from '@/types/management'
import { useNavigationStore } from '@/stores/navigation'
import ConsoleDashboard from '@/components/console/ConsoleDashboard.vue'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api', () => ({ apiClient: { get } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { displayName: '用户甲' } }) }))

function node(
  id: string,
  displayName: string,
  routePath: string | null,
  children: NavigationNode[] = [],
  overrides: Partial<NavigationNode> = {},
): NavigationNode {
  return {
    id,
    displayName,
    routePath,
    children,
    parentId: null,
    code: id,
    type: routePath ? 'PAGE' : 'MENU',
    permissionCode: null,
    routeKey: id,
    iconKey: 'order',
    sortOrder: 0,
    visible: true,
    keepAlive: true,
    ...overrides,
  }
}
const order = () =>
  node('supply.order.sales-orders', '销售订单', '/supply-chain/order/sales-orders')
const home = () => node('supply.dashboard', '供应链首页', '/supply-chain')
const wrappers: ReturnType<typeof mount>[] = []
async function render(
  applicationCode = 'SUPPLY_CHAIN',
  nodes: NavigationNode[] | null = [home(), order()],
) {
  const roots: Record<string, string> = {
    SUPPLY_CHAIN: '/supply-chain',
    PLATFORM_ADMIN: '/platform-admin',
    SYSTEM_ADMIN: '/system-admin',
  }
  const pinia = createPinia()
  const navigation = useNavigationStore(pinia)
  if (nodes) {
    navigation.navigationByApplication[applicationCode] = nodes
    navigation.loadedApplications.push(applicationCode)
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: Object.entries(roots).map(([code, path]) => ({
      path: `${path}/:rest(.*)*`,
      component: { template: '<div />' },
      meta: { applicationCode: code, title: '业务首页' },
    })),
  })
  await router.push(roots[applicationCode])
  await router.isReady()
  const wrapper = mount(ConsoleDashboard, { global: { plugins: [pinia, router, ElementPlus] } })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, navigation, router }
}
function pending() {
  let resolve!: (nodes: NavigationNode[]) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<NavigationNode[]>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
beforeEach(() => {
  get.mockReset().mockResolvedValue([])
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('console dashboard authorized navigation', () => {
  it('recurses visible groups, excludes the current home and hidden branches, and keeps only authorized exact links', async () => {
    const { wrapper, router } = await render('SUPPLY_CHAIN', [
      home(),
      node('orders', '订单管理', null, [
        order(),
        node('nested', '售后业务', null, [
          node('refunds', '销售退款', '/supply-chain/order/sales-refunds'),
        ]),
      ]),
      node(
        'hidden-parent',
        '隐藏管理',
        null,
        [node('secret', '秘密页面', '/supply-chain/secret')],
        { visible: false },
      ),
      node('hidden', '隐藏页面', '/supply-chain/hidden', [], { visible: false }),
      node('empty', '空分组', null),
      order(),
    ])
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toEqual([
      '/supply-chain/order/sales-orders',
      '/supply-chain/order/sales-refunds',
    ])
    expect(wrapper.get('h1').text()).toBe('供应链首页')
    expect(wrapper.text()).toContain('订单管理')
    expect(wrapper.text()).toContain('售后业务')
    expect(wrapper.text()).not.toMatch(
      /隐藏|秘密页面|空分组|新业务主流程|当前落地范围|下一步|接口未接入|今日订单金额|待办/,
    )
    expect(get).not.toHaveBeenCalled()
    await wrapper.get('a[href="/supply-chain/order/sales-orders"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/supply-chain/order/sales-orders')
  })

  it('searches entry names and group names without exposing hidden entries or requesting navigation', async () => {
    const { wrapper } = await render('SUPPLY_CHAIN', [
      node('erp', '商品中心', null, [node('products', '商品管理', '/supply-chain/erp/products')]),
      node('orders', '订单管理', null, [order()]),
    ])
    const search = wrapper.get('input[aria-label="搜索业务入口"]')
    await search.setValue('  商品中心 ')
    expect(wrapper.findAll('a').map((link) => link.text())).toEqual(['商品管理'])
    await search.setValue('销售订单')
    expect(wrapper.findAll('a').map((link) => link.text())).toEqual(['销售订单'])
    await search.setValue('无匹配')
    expect(wrapper.text()).toContain('没有匹配的业务入口')
    expect(wrapper.text()).not.toContain('暂无已授权')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '清空搜索')!
      .trigger('click')
    expect(wrapper.findAll('a')).toHaveLength(2)
    expect(get).not.toHaveBeenCalled()
  })
  it('waits for the Shell request without fetching twice and updates when that request succeeds', async () => {
    const { wrapper, navigation } = await render('SUPPLY_CHAIN', null)
    expect(wrapper.text()).toContain('业务入口尚未加载')
    expect(wrapper.text()).not.toContain('暂无已授权')
    expect(get).not.toHaveBeenCalled()
    const request = pending()
    get.mockReturnValueOnce(request.promise)
    const shellRequest = navigation.fetchNavigation('SUPPLY_CHAIN')
    await flushPromises()
    expect(wrapper.text()).toContain('正在加载业务入口')
    expect(wrapper.findAll('button').some((button) => button.text() === '重新加载')).toBe(false)
    request.resolve([home(), order()])
    await shellRequest
    await flushPromises()
    expect(wrapper.get('nav').text()).toContain('销售订单')
    expect(get).toHaveBeenCalledTimes(1)
  })
  it.each([new Error('network failure'), { code: 'FORBIDDEN' }])(
    'shows a retryable failed navigation read without stale authorized links: %j',
    async (reason) => {
      const { wrapper, navigation } = await render()
      get.mockRejectedValueOnce(reason)
      await navigation.fetchNavigation('SUPPLY_CHAIN').catch(() => {})
      await flushPromises()
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
      expect(wrapper.find('a').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('network failure')
      get.mockResolvedValueOnce([order()])
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '重新加载')!
        .trigger('click')
      await flushPromises()
      expect(wrapper.get('nav').text()).toContain('销售订单')
      expect(get).toHaveBeenCalledTimes(2)
    },
  )
  it('offers a permission refresh for an empty authorized menu and prevents concurrent retries', async () => {
    const { wrapper } = await render('SUPPLY_CHAIN', [home()])
    expect(wrapper.text()).toContain('暂无已授权的业务入口')
    const request = pending()
    get.mockReturnValueOnce(request.promise)
    const retry = wrapper.findAll('button').find((button) => button.text() === '重新加载')!
    await retry.trigger('click')
    await retry.trigger('click')
    expect(get).toHaveBeenCalledTimes(1)
    request.resolve([order()])
    await flushPromises()
    expect(wrapper.get('nav').text()).toContain('销售订单')
  })

  it('keeps the existing route registry validation on manual retries', async () => {
    const { wrapper } = await render('SUPPLY_CHAIN', null)
    get.mockResolvedValueOnce([node('unknown-route', '不应出现', '/unregistered')])
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '重新加载')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('业务入口加载失败')
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('unknown-route')
  })
})
