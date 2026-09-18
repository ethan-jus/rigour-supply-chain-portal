import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { routeLocationKey, type RouteLocationNormalizedLoaded } from 'vue-router'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { useNavigationStore } from '@/stores/navigation'
import type { NavigationNode } from '@/types/management'
afterEach(() => {
  document.body.innerHTML = ''
})
function render(app: string, nodes: NavigationNode[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useNavigationStore().navigationByApplication[app] = nodes
  return mount(SupplyPageTitle, {
    slots: { default: '原页面标题' },
    global: {
      plugins: [pinia],
      provide: {
        [routeLocationKey as symbol]: {
          path: '/example',
          meta: { applicationCode: app },
        } as RouteLocationNormalizedLoaded,
      },
    },
  })
}
const node = {
  routePath: '/example',
  displayName: '自定义名称',
  visible: false,
  children: [],
} as unknown as NavigationNode
describe('供应链页面标题', () => {
  it('无菜单配置时保留页面原有标题', () => {
    const wrapper = render('SUPPLY_CHAIN', [])
    expect(wrapper.get('h1').text()).toBe('原页面标题')
    wrapper.unmount()
  })
  it('已授权的隐藏菜单仍使用自定义名称', () => {
    const wrapper = render('SUPPLY_CHAIN', [node])
    expect(wrapper.get('h1').text()).toBe('自定义名称')
    wrapper.unmount()
  })
  it('其他应用不受供应链标题策略影响', () => {
    const wrapper = render('SYSTEM_ADMIN', [node])
    expect(wrapper.get('h1').text()).toBe('原页面标题')
    wrapper.unmount()
  })
})
