import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { expect, it } from 'vitest'
import ConsoleSidebar from '@/components/console/ConsoleSidebar.vue'
import type { NavigationNode } from '@/types/management'

function node(key: string, name: string, children?: NavigationNode[]): NavigationNode {
  return {
    id: key,
    parentId: null,
    code: key,
    type: children ? 'MENU' : 'PAGE',
    displayName: name,
    permissionCode: children ? null : key,
    routeKey: `supply.settings.${key}`,
    routePath: children ? null : `/supply-chain/settings/${key}`,
    iconKey: null,
    sortOrder: 0,
    visible: true,
    keepAlive: false,
    children: children ?? [],
  }
}
it('公共资料常显分组独立于地域权限；权限撤销后不留下空分组或隐藏入口', async () => {
  const directory = node('admin-divisions', '行政区划')
  const territory = node('store-territories', '客户地域权限')
  const reference = node('public-reference', '公共资料', [directory])
  const root = node('index', '系统设置', [territory, reference])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/supply-chain/:rest(.*)*', component: { template: '<div />' } }],
  })
  await router.push(directory.routePath!)
  await router.isReady()
  const wrapper = mount(ConsoleSidebar, {
    props: { nodes: [root] },
    global: { plugins: [createPinia(), router] },
  })
  try {
    expect(wrapper.findAll('.settings-nav-group h2').map((n) => n.text())).toEqual([
      '系统管理',
      '公共资料',
    ])
    expect(wrapper.find('.settings-nav-group .nav-branch').exists()).toBe(false)
    expect(wrapper.get('[aria-current="page"]').text()).toBe('行政区划')
    await wrapper.get(`a[href="${territory.routePath}"]`).trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(territory.routePath)
    await wrapper.setProps({
      nodes: [{ ...root, children: [territory, { ...reference, visible: false }] }],
    })
    expect(wrapper.find('.settings-nav-group h2').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('公共资料')
    expect(wrapper.text()).not.toContain('行政区划')
    expect(wrapper.text()).toContain('客户地域权限')
  } finally {
    wrapper.unmount()
  }
})
