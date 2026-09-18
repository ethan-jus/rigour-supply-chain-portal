import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import ServiceUnavailableView from '@/views/error/ServiceUnavailableView.vue'
import LoginView from '@/views/login/LoginView.vue'
import { useAuthStore } from '@/stores/auth'

describe('ServiceUnavailableView', () => {
  it('手工返回登录时清理保留的本地会话并显示登录表单，不形成503循环', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    ;(authStore as unknown as Record<string, unknown>).isAuthenticated = true
    authStore.user = {
      id: 'user-503', principalScope: 'TENANT', username: 'operator', displayName: '操作员',
      roles: ['operator'], permissions: [], tenantId: 'tenant-1', tenantName: '测试租户',
    }
    const login = vi.spyOn(authStore, 'login').mockResolvedValue(undefined)
    const placeholder = defineComponent({ template: '<div />' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/service-unavailable', component: ServiceUnavailableView },
        { path: '/login', component: LoginView },
        { path: '/supply-chain/order/sales-orders', component: placeholder },
      ],
    })
    const redirect = '/supply-chain/order/sales-orders?tab=pending'
    await router.push({ path: '/service-unavailable', query: { redirect } })
    await router.isReady()
    const root = defineComponent({ render: () => h(RouterView) })
    const wrapper = mount(root, {
      global: {
        plugins: [pinia, router],
        stubs: {
          'el-button': defineComponent({
            emits: ['click'],
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          }),
        },
      },
    })

    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBeUndefined()
    expect(router.currentRoute.value.query.reason).toBe('service_unavailable')
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.user).toBeNull()
    expect(login).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).not.toBe('/service-unavailable')

    wrapper.unmount()
  })
})
