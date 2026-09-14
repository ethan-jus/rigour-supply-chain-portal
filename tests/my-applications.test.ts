import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { vi } from 'vitest'
import { useApplicationStore, useAuthStore, useNavigationStore } from '@/stores'
import MyApplicationsView from '@/views/apps/MyApplicationsView.vue'

describe('MyApplicationsView菜单懒加载', () => {
  it('加载应用卡片时不预取所有应用导航', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.user = {
      id: 'u-1', principalScope: 'TENANT', username: 'operator', displayName: '运营员',
      roles: ['operator'], permissions: [], tenantId: 'tenant-1', tenantName: '测试租户',
    }
    vi.spyOn(authStore, 'fetchUser').mockResolvedValue(undefined)
    const applicationStore = useApplicationStore()
    vi.spyOn(applicationStore, 'fetchApplications').mockImplementation(async () => {
      applicationStore.applications = [{
        id: 'app-1', code: 'SUPPLY_CHAIN', name: '供应链系统', iconKey: null,
        launchMode: 'INTERNAL_ROUTE', targetUri: '/supply-chain', sortOrder: 10,
      }]
      applicationStore.loaded = true
    })
    const navigationStore = useNavigationStore()
    const resetNavigation = vi.spyOn(navigationStore, 'reset')
    const fetchNavigation = vi.spyOn(navigationStore, 'fetchNavigation')

    const placeholder = defineComponent({ template: '<div />' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/apps', component: placeholder }],
    })
    await router.push('/apps')
    await router.isReady()
    const wrapper = mount(MyApplicationsView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          ApplicationCard: true,
          'el-button': true,
          'el-empty': true,
          'el-result': true,
          'el-skeleton': true,
        },
      },
    })

    await flushPromises()

    expect(authStore.fetchUser).toHaveBeenCalledOnce()
    expect(resetNavigation).toHaveBeenCalledOnce()
    expect(applicationStore.fetchApplications).toHaveBeenCalledOnce()
    expect(fetchNavigation).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
