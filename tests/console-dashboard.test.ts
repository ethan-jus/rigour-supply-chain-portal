import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NavigationNode } from '@/types/management'
import { useNavigationStore } from '@/stores/navigation'
import ConsoleDashboard from '@/components/console/ConsoleDashboard.vue'
import ConsoleSidebar from '@/components/console/ConsoleSidebar.vue'
import ConsoleEntrySearch from '@/components/console/ConsoleEntrySearch.vue'
import { consoleEntries } from '@/utils/console-navigation'
import { meetingFixture } from './fixtures/bi-meeting-data'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  overview: vi.fn(),
  analysis: vi.fn(),
  scope: vi.fn(),
  orders: vi.fn(),
  payments: vi.fn(),
}))
vi.mock('@/api', () => ({ apiClient: { get: mocks.get } }))
vi.mock('@/api/core/bi', () => ({
  getSupplyDashboardOverview: mocks.overview,
  getSupplyDashboardOperatingAnalysis: mocks.analysis,
}))
vi.mock('@/api/core/bi-access', () => ({ getBiEffectiveScope: mocks.scope }))
vi.mock('@/api/core/order-register', () => ({
  getOrderRegisterOrders: mocks.orders,
  getOrderRegisterPayments: mocks.payments,
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: '1', tenantId: 'demo' } }) }))
function node(
  id: string,
  displayName: string,
  routePath: string | null,
  children: NavigationNode[] = [],
  visible = true,
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
    iconKey: 'Document',
    sortOrder: 0,
    visible,
    keepAlive: true,
  }
}
const home = node('supply.dashboard', '工作首页', '/supply-chain')
const order = node('supply.order.sales-orders', '销售订单', '/supply-chain/order/sales-orders')
const payments = node(
  'supply.order.sales-payments',
  '收款记录',
  '/supply-chain/order/sales-payments',
)
const bi = node('supply.bi.overview', '经营总览', '/supply-chain/bi')
const wrappers: ReturnType<typeof mount>[] = []
async function render(nodes: NavigationNode[] | null = [home, order, payments, bi]) {
  const pinia = createPinia()
  const navigation = useNavigationStore(pinia)
  if (nodes) {
    navigation.navigationByApplication.SUPPLY_CHAIN = nodes
    navigation.loadedApplications.push('SUPPLY_CHAIN')
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/supply-chain/:rest(.*)*',
        component: { template: '<div />' },
        meta: { applicationCode: 'SUPPLY_CHAIN', title: '工作首页' },
      },
    ],
  })
  await router.push('/supply-chain')
  await router.isReady()
  const global = { plugins: [pinia, router, ElementPlus] }
  const wrapper = mount(ConsoleDashboard, { global })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, navigation, router, global }
}
beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset())
  const fixture = meetingFixture()
  mocks.get.mockResolvedValue([])
  mocks.scope.mockResolvedValue({ accessLevel: 'TENANT' })
  mocks.overview.mockResolvedValue(fixture.current)
  mocks.analysis.mockResolvedValue(fixture.analysis)
  mocks.orders.mockResolvedValue({ total: 12, items: [] })
  mocks.payments.mockResolvedValue({
    total: 8,
    items: [
      {
        id: 'pay-1',
        orderNo: 'OLDER-ORDER',
        customerName: '测试客户',
        paidAmount: 500,
        paymentTime: '2026-09-23T08:00:00+08:00',
      },
    ],
  })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('供应链工作台', () => {
  it('reads actual receipts separately from order collections, calculates cohort repurchase and uses matching task filters', async () => {
    const { wrapper } = await render()
    expect(wrapper.get('h1').text()).toBe('工作台')
    expect(wrapper.get('.summary-metric--receipts strong').text()).toBe('¥106.2万')
    expect(wrapper.get('.summary-metric--retention strong').text()).toBe('44.9%')
    expect(wrapper.get('.summary-metric--retention > b').text()).toBe('218 / 486')
    expect(mocks.overview).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringMatching(/-01T00:00:00\+08:00$/),
        to: expect.stringMatching(/T23:59:59\.999999\+08:00$/),
      }),
    )
    expect(mocks.orders).toHaveBeenCalledWith(
      expect.objectContaining({ orderStatusCode: 'PENDING_SHIPPED', step: 5 }),
    )
    expect(mocks.orders).toHaveBeenCalledWith(expect.objectContaining({ hasUnpaid: true }))
    expect(mocks.payments).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatusCode: 'RECEIVED' }),
    )
    expect(wrapper.get('.task-row-action').attributes('href')).toContain(
      'homeTask=payment&orderNo=OLDER-ORDER',
    )
    await wrapper.get('#home-task-unpaid').trigger('click')
    expect(wrapper.get('.task-footer a').attributes('href')).toContain('homeTask=unpaid')
  })
  it('does not request unauthorized data or promote descendants of hidden menu groups', async () => {
    const hidden = node('hidden', '隐藏业务', null, [order, payments, bi], false)
    const { wrapper } = await render([home, hidden])
    expect(consoleEntries([home, hidden]).map((item) => item.path)).toEqual(['/supply-chain'])
    expect(wrapper.text()).toContain('暂无经营数据访问权限')
    expect(wrapper.text()).toContain('暂无已授权的业务待办')
    expect(mocks.scope).not.toHaveBeenCalled()
    expect(mocks.orders).not.toHaveBeenCalled()
    expect(mocks.payments).not.toHaveBeenCalled()
  })
  it('shows missing targets and failures as unavailable rather than fabricated zero results', async () => {
    const fixture = meetingFixture()
    fixture.current.cityTargetCompletions = []
    mocks.overview.mockResolvedValue(fixture.current)
    mocks.analysis.mockRejectedValue(new Error('unavailable'))
    mocks.payments.mockRejectedValue(new Error('private details'))
    const { wrapper } = await render()
    expect(wrapper.text()).toContain('尚未设置目标')
    expect(wrapper.get('.summary-metric--retention strong').text()).toBe('—')
    expect(wrapper.text()).toContain('复购数据暂不可用')
    expect(wrapper.text()).toContain('待办加载失败')
    expect(wrapper.text()).not.toContain('private details')
    expect(wrapper.text()).not.toContain('暂无待核回款事项')
  })
  it('blocks BI queries when the server effective scope denies access', async () => {
    mocks.scope.mockResolvedValue({ accessLevel: 'DENIED' })
    const { wrapper } = await render()
    expect(mocks.overview).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('经营数据暂不可用')
  })
  it('discards in-flight business responses after permission removal', async () => {
    let resolve!: (data: unknown) => void
    mocks.payments.mockReturnValue(
      new Promise((yes) => {
        resolve = yes
      }),
    )
    const { wrapper, navigation } = await render()
    navigation.navigationByApplication.SUPPLY_CHAIN = [home]
    await flushPromises()
    resolve({
      total: 999,
      items: [{ id: 'secret', customerName: '不应显示的客户', paidAmount: 123 }],
    })
    await flushPromises()
    expect(wrapper.text()).not.toContain('不应显示的客户')
    expect(wrapper.text()).not.toContain('999')
  })
  it('waits for Shell navigation, retries failures and retains route validation', async () => {
    const { wrapper, navigation } = await render(null)
    expect(wrapper.text()).toContain('业务入口尚未加载')
    expect(mocks.get).not.toHaveBeenCalled()
    mocks.get.mockResolvedValueOnce([home, order])
    await navigation.fetchNavigation('SUPPLY_CHAIN')
    await flushPromises()
    expect(wrapper.get('.home-shortcuts').text()).toContain('销售订单')
    mocks.get.mockRejectedValueOnce(new Error('network'))
    await navigation.fetchNavigation('SUPPLY_CHAIN').catch(() => {})
    await flushPromises()
    expect(wrapper.text()).toContain('业务入口加载失败')
    expect(wrapper.find('a').exists()).toBe(false)
    mocks.get.mockResolvedValueOnce([node('unknown', '非法页面', '/unregistered')])
    await wrapper.get('.home-state button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('业务入口加载失败')
    expect(wrapper.text()).not.toContain('非法页面')
  })
  it('collapses the secondary column, reopens modules and searches the same authorized tree with keyboard navigation', async () => {
    const nodes = [home, node('supply.order.menu', '订单管理', null, [order, payments])]
    const { global, router } = await render(nodes)
    const sidebar = mount(ConsoleSidebar, { props: { nodes }, global })
    wrappers.push(sidebar)
    await sidebar.get('[aria-label="收起二级菜单"]').trigger('click')
    expect(sidebar.classes()).toContain('is-collapsed')
    await sidebar.get('button[aria-label="订单管理"]').trigger('click')
    expect(sidebar.classes()).not.toContain('is-collapsed')
    expect(sidebar.get('.secondary-nav').text()).toContain('销售订单')
    const search = mount(ConsoleEntrySearch, { props: { entries: consoleEntries(nodes) }, global })
    wrappers.push(search)
    expect(search.find('input').exists()).toBe(false)
    await search.get('[aria-label="打开入口搜索"]').trigger('click')
    await search.get('input').setValue('临时搜索')
    await search.get('input').trigger('keydown.esc')
    expect(search.find('input').exists()).toBe(false)
    await search.get('[aria-label="打开入口搜索"]').trigger('click')
    expect((search.get('input').element as HTMLInputElement).value).toBe('')
    await search.get('input').setValue('订单管理')
    expect(search.findAll('a')).toHaveLength(2)
    await search.get('input').setValue('销售订单')
    await search.get('input').trigger('keydown.enter')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(order.routePath)
    expect(search.find('.entry-search__results').exists()).toBe(false)
    expect(search.find('input').exists()).toBe(false)
  })
})
