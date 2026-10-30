import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import ConsoleSidebar from '@/components/console/ConsoleSidebar.vue'
import type { NavigationNode } from '@/types/management'
import { crmNavigationSections } from '@/utils/crm-navigation'

function page(path: string, displayName: string): NavigationNode {
  return {
    id: path,
    parentId: null,
    code: path,
    type: 'PAGE',
    displayName,
    permissionCode: `crm:${path}`,
    routeKey: `supply.crm.${path.replaceAll('/', '.')}`,
    routePath: `/supply-chain/crm/${path}`,
    iconKey: null,
    sortOrder: 0,
    visible: true,
    keepAlive: true,
    children: [],
  }
}
function customerMenu(children: NavigationNode[]): NavigationNode[] {
  return [
    {
      ...page('menu', 'CRM'),
      routePath: null,
      type: 'MENU',
      children: [
        { ...page('customers/menu', '客户管理'), routePath: null, type: 'MENU', children },
      ],
    },
  ]
}
const mine = page('stores/mine', '我的客户')
const publicPool = page('stores/public', '公海')
const profile = page('customers/profiles', '客户档案')

async function render(children: NavigationNode[]) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/supply-chain/:rest(.*)*', component: { template: '<div />' } }],
  })
  await router.push(publicPool.routePath!)
  await router.isReady()
  const wrapper = mount(ConsoleSidebar, {
    props: { nodes: customerMenu(children) },
    global: { plugins: [createPinia(), router] },
  })
  return { wrapper, router }
}

describe('客户模块导航', () => {
  it('只组织可见授权入口，保留自定义名称、图标、顺序及未知入口', () => {
    const custom = { ...profile, displayName: '华东客户档案', iconKey: 'User' }
    const hidden = {
      ...page('hidden', '隐藏分组'),
      visible: false,
      children: [page('stores/library', '不应显示')],
    }
    const source = customerMenu([
      publicPool,
      mine,
      custom,
      hidden,
      page('custom/report', '自定义报表'),
      publicPool,
    ])
    const before = structuredClone(source)
    const groups = crmNavigationSections(source)
    expect(groups.map((group) => group.title)).toEqual(['客户经营', '基础资料', '其他功能'])
    expect(groups[0]!.nodes.map((node) => node.id)).toEqual([publicPool.id, mine.id])
    expect(groups[0]!.nodes[0]).toMatchObject({ ...publicPool, iconKey: 'Shop' })
    expect(groups[1]!.nodes).toEqual([custom])
    expect(groups[2]!.nodes[0]!.displayName).toBe('自定义报表')
    expect(source).toEqual(before)
  })

  it('两组常显、无客户管理折叠层，点击入口更新路由和当前页标识', async () => {
    const { wrapper, router } = await render([mine, publicPool, profile])
    try {
      expect(wrapper.get('.module-link[aria-label="CRM"]').text()).toBe('CRM')
      expect(wrapper.get('.secondary-nav__heading strong').text()).toBe('客户关系管理')
      expect(wrapper.findAll('.crm-nav-group h2').map((node) => node.text())).toEqual([
        '客户经营',
        '基础资料',
      ])
      expect(wrapper.find('.crm-navigation .nav-branch').exists()).toBe(false)
      expect(wrapper.get('.crm-navigation').text()).not.toContain('客户管理')
      expect(wrapper.get('.crm-navigation [aria-current="page"]').text()).toBe('公海')
      await wrapper.get(`.crm-navigation a[href="${mine.routePath}"]`).trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe(mine.routePath)
      expect(wrapper.get('.crm-navigation [aria-current="page"]').text()).toBe('我的客户')
      expect(wrapper.findAll('.crm-navigation a .nav-icon')).toHaveLength(3)
    } finally {
      wrapper.unmount()
    }
  })

  it('权限刷新后仅一组就平铺，撤销的入口及空分组立即消失', async () => {
    const { wrapper } = await render([mine, publicPool, profile])
    try {
      await wrapper.setProps({
        nodes: customerMenu([mine, publicPool, { ...profile, visible: false }]),
      })
      expect(wrapper.find('.crm-nav-group h2').exists()).toBe(false)
      expect(wrapper.findAll('.crm-navigation a').map((node) => node.text())).toEqual([
        '我的客户',
        '公海',
      ])
      await wrapper.setProps({ nodes: [] })
      expect(wrapper.find('.crm-navigation').exists()).toBe(false)
      expect(wrapper.text()).toContain('暂无可用菜单')
    } finally {
      wrapper.unmount()
    }
  })
})
