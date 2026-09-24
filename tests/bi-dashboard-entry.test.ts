import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import DashboardView from '@/views/supply-chain/bi/DashboardView.vue'
import { constantRoutes as routes } from '@/router/routes'

vi.mock('@/views/supply-chain/bi/components/BiMeetingPresentation.vue', () => ({
  default: {
    name: 'BiMeetingPresentation',
    props: {
      embedded: Boolean,
      query: Object,
      scopeLabel: String,
      initialCity: Boolean,
      initialPage: Number,
    },
    emits: ['city', 'overview', 'report'],
    template: '<main>经营设计看板</main>',
  },
}))
vi.mock('@/views/supply-chain/bi/components/BiSalesMeetingPresentation.vue', () => ({
  default: {
    name: 'BiSalesMeetingPresentation',
    props: { embedded: Boolean, query: Object, scopeLabel: String },
    template: '<main>销售设计看板</main>',
  },
}))
const paths = [
  ['/supply-chain/bi', 'overview'],
  ['/supply-chain/bi/city-operating', 'city-operating'],
  ['/supply-chain/bi/sales', 'sales'],
] as const
async function render(url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: paths.map(([path, section]) => ({
      path,
      component: DashboardView,
      meta: { title: section, dashboardSection: section },
    })),
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [router] } })
  return { router, wrapper }
}
describe('替换原看板页面', () => {
  it.each(paths)(
    '%s 直接显示设计看板，旧链接的 view 参数也不会回到旧页面',
    async (path, section) => {
      const { wrapper } = await render(
        `${path}?view=collection&regionCode=HZ&from=2026-08-01&to=2026-08-31`,
      )
      const board = wrapper.getComponent({
        name: section === 'sales' ? 'BiSalesMeetingPresentation' : 'BiMeetingPresentation',
      })
      expect(board.props('embedded')).toBe(true)
      expect(board.props('query')).toMatchObject({
        regionCode: 'HZ',
        from: '2026-08-01',
        to: '2026-08-31',
      })
      if (section !== 'sales') expect(board.props('initialCity')).toBe(section === 'city-operating')
      expect(wrapper.find('button').exists()).toBe(false)
      wrapper.unmount()
    },
  )
  it('三个正式菜单路由使用新的页面组件，同时保留原权限要求', async () => {
    const supply = routes.find((route) => route.path === '/supply-chain')!
    for (const name of ['SupplyBi', 'SupplyBiSales', 'SupplyBiCityOperating']) {
      const route = supply.children!.find((child) => child.name === name)!
      expect(route.meta?.permission).toBe('analytics:dashboard:read')
      const module = await (route.component as () => Promise<{ default: unknown }>)()
      expect(module.default).toBe(DashboardView)
    }
  })
  it('城市和总览之间保留月份、城市范围，目标链接进入新总览目标屏', async () => {
    const { wrapper, router } = await render('/supply-chain/bi')
    const filters = {
      from: '2026-08-01T00:00:00+08:00',
      to: '2026-08-31T23:59:59+08:00',
      regionCode: 'HZ',
    }
    wrapper.getComponent({ name: 'BiMeetingPresentation' }).vm.$emit('city', filters)
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/supply-chain/bi/city-operating')
    expect(router.currentRoute.value.query).toMatchObject({ regionCode: 'HZ', from: '2026-08-01' })
    wrapper.getComponent({ name: 'BiMeetingPresentation' }).vm.$emit('report', 1, filters)
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/supply-chain/bi')
    expect(wrapper.getComponent({ name: 'BiMeetingPresentation' }).props('initialPage')).toBe(1)
    wrapper.unmount()
  })
})
