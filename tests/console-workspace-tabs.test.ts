import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import {
  createMemoryHistory,
  createRouter,
  RouterView,
  useRoute,
  type Router,
} from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'
import ConsoleShell from '@/layouts/ConsoleShell.vue'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import type { NavigationNode } from '@/types/management'

const lifecycle = {
  mounted: {} as Record<string, number>,
  unmounted: {} as Record<string, number>,
}

const SharedStatePage = defineComponent({
  name: 'SharedStatePage',
  setup() {
    const route = useRoute()
    const pageKey = computed(() => String(route.meta.pageKey || 'unknown'))
    const state = ref('')

    onMounted(() => {
      lifecycle.mounted[pageKey.value] = (lifecycle.mounted[pageKey.value] ?? 0) + 1
    })
    onUnmounted(() => {
      lifecycle.unmounted[pageKey.value] = (lifecycle.unmounted[pageKey.value] ?? 0) + 1
    })

    // 模拟订单、ERP、CRM 等复用页面对 route.meta 的现有监听。
    watch(() => route.meta.pageKey, () => {
      state.value = ''
    })

    return { pageKey, route, state }
  },
  template: `
    <article class="sentinel-page" :data-page="pageKey">
      <input v-model="state" class="sentinel-input">
      <span class="sentinel-route">{{ route.fullPath }}</span>
    </article>
  `,
})

function navigationNode(path: string, title: string, routeKey: string): NavigationNode {
  return {
    id: routeKey,
    parentId: null,
    code: routeKey,
    type: 'PAGE',
    displayName: title,
    permissionCode: null,
    routeKey,
    routePath: path,
    iconKey: null,
    sortOrder: 1,
    visible: true,
    keepAlive: false,
    children: [],
  }
}

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/apps', component: defineComponent({ template: '<div>应用门户</div>' }) }, {
      path: '/supply-chain',
      component: ConsoleShell,
      meta: { title: '供应链系统', applicationCode: 'SUPPLY_CHAIN' },
      children: [
        {
          path: '',
          component: SharedStatePage,
          meta: { title: '供应链首页', applicationCode: 'SUPPLY_CHAIN', pageKey: 'home' },
        },
        {
          path: 'alpha',
          component: SharedStatePage,
          meta: { title: '甲页面', applicationCode: 'SUPPLY_CHAIN', pageKey: 'alpha' },
        },
        {
          path: 'beta',
          component: SharedStatePage,
          meta: { title: '乙页面', applicationCode: 'SUPPLY_CHAIN', pageKey: 'beta' },
        },
        {
          path: 'gamma',
          component: SharedStatePage,
          meta: { title: '丙页面', applicationCode: 'SUPPLY_CHAIN', pageKey: 'gamma' },
        },
      ],
    }],
  })
}

async function mountConsole(initialPath = '/supply-chain/alpha') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore()
  authStore.user = {
    id: 'user-1',
    principalScope: 'TENANT',
    username: 'operator',
    displayName: '业务员',
    roles: ['operator'],
    permissions: [],
    tenantId: 'tenant-1',
    tenantName: '演示企业',
  }

  const navigationStore = useNavigationStore()
  navigationStore.navigationByApplication.SUPPLY_CHAIN = [
    navigationNode('/supply-chain', '供应链首页', 'home'),
    navigationNode('/supply-chain/alpha', '甲页面', 'alpha'),
    navigationNode('/supply-chain/beta', '乙页面', 'beta'),
    navigationNode('/supply-chain/gamma', '丙页面', 'gamma'),
  ]
  navigationStore.loadedApplications.push('SUPPLY_CHAIN')

  const router = createTestRouter()
  await router.push(initialPath)
  await router.isReady()

  const wrapper = mount(defineComponent({
    components: { RouterView },
    template: '<RouterView />',
  }), {
    attachTo: document.body,
    global: {
      plugins: [pinia, router],
      stubs: {
        ConsoleNavTree: true,
        ElButton: defineComponent({ template: '<button><slot /></button>' }),
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

function tabByTitle(wrapper: VueWrapper, title: string) {
  const tab = wrapper.findAll('.workspace-tab').find((item) => item.text().includes(title))
  if (!tab) throw new Error(`未找到页签：${title}`)
  return tab
}

describe('ConsoleShell 工作页签', () => {
  beforeEach(() => {
    lifecycle.mounted = {}
    lifecycle.unmounted = {}
    document.body.innerHTML = ''
  })

  it('用页签替代系统面包屑，并在共享组件路由之间保留独立页面状态', async () => {
    const { wrapper, router } = await mountConsole()

    expect(wrapper.findAll('.workspace-tab')).toHaveLength(1)
    expect(tabByTitle(wrapper, '甲页面').attributes('aria-current')).toBe('page')
    expect(wrapper.text()).not.toContain('供应链系统 /')

    await wrapper.get('.sentinel-input').setValue('甲页面筛选条件')
    await router.push('/supply-chain/beta')
    await flushPromises()
    expect(wrapper.findAll('.workspace-tab')).toHaveLength(2)
    expect(wrapper.get('.sentinel-page').attributes('data-page')).toBe('beta')
    await wrapper.get('.sentinel-input').setValue('乙页面筛选条件')

    await tabByTitle(wrapper, '甲页面').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/supply-chain/alpha')
    expect(wrapper.get<HTMLInputElement>('.sentinel-input').element.value).toBe('甲页面筛选条件')
    expect(lifecycle.mounted.alpha).toBe(1)

    await tabByTitle(wrapper, '乙页面').trigger('click')
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('.sentinel-input').element.value).toBe('乙页面筛选条件')
    expect(lifecycle.mounted.beta).toBe(1)

    wrapper.unmount()
  })

  it('同一路径更新查询参数不新增页签，也不重新挂载页面', async () => {
    const { wrapper, router } = await mountConsole()
    await wrapper.get('.sentinel-input').setValue('保留条件')

    await router.push({ path: '/supply-chain/alpha', query: { keyword: 'A-01' } })
    await flushPromises()

    expect(wrapper.findAll('.workspace-tab')).toHaveLength(1)
    expect(wrapper.get('.sentinel-route').text()).toContain('keyword=A-01')
    expect(wrapper.get<HTMLInputElement>('.sentinel-input').element.value).toBe('保留条件')
    expect(lifecycle.mounted.alpha).toBe(1)

    wrapper.unmount()
  })

  it('切换页签会分别恢复各页面的内容滚动位置', async () => {
    const { wrapper, router } = await mountConsole()
    const viewport = wrapper.get<HTMLElement>('.console__content').element
    viewport.scrollTop = 144

    await router.push('/supply-chain/beta')
    await flushPromises()
    expect(viewport.scrollTop).toBe(0)
    viewport.scrollTop = 36

    await tabByTitle(wrapper, '甲页面').trigger('click')
    await flushPromises()
    expect(viewport.scrollTop).toBe(144)

    await tabByTitle(wrapper, '乙页面').trigger('click')
    await flushPromises()
    expect(viewport.scrollTop).toBe(36)

    wrapper.unmount()
  })

  it('关闭页签会真正卸载缓存；关闭活动页时切到右侧相邻页，重新打开使用全新状态', async () => {
    const { wrapper, router } = await mountConsole()
    await router.push('/supply-chain/beta')
    await router.push('/supply-chain/gamma')
    await flushPromises()
    expect(wrapper.findAll('.workspace-tab')).toHaveLength(3)

    await tabByTitle(wrapper, '乙页面').get('.workspace-tab__close').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/supply-chain/gamma')
    expect(wrapper.findAll('.workspace-tab')).toHaveLength(2)
    expect(lifecycle.unmounted.beta).toBe(1)

    await tabByTitle(wrapper, '甲页面').trigger('click')
    await flushPromises()
    await tabByTitle(wrapper, '甲页面').get('.workspace-tab__close').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/supply-chain/gamma')
    expect(lifecycle.unmounted.alpha).toBe(1)
    expect(wrapper.findAll('.workspace-tab')).toHaveLength(1)
    expect(tabByTitle(wrapper, '丙页面').find('.workspace-tab__close').exists()).toBe(true)

    await router.push('/supply-chain/alpha')
    await flushPromises()
    expect(lifecycle.mounted.alpha).toBe(2)
    expect(wrapper.get<HTMLInputElement>('.sentinel-input').element.value).toBe('')

    wrapper.unmount()
  })

  it('关闭最后一个业务页签会回到应用首页，首页作为唯一页签时不显示关闭按钮', async () => {
    const { wrapper, router } = await mountConsole('/supply-chain/beta')

    await tabByTitle(wrapper, '乙页面').get('.workspace-tab__close').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/supply-chain')
    expect(wrapper.findAll('.workspace-tab')).toHaveLength(1)
    expect(tabByTitle(wrapper, '供应链首页').find('.workspace-tab__close').exists()).toBe(false)
    expect(lifecycle.unmounted.beta).toBe(1)

    wrapper.unmount()
  })
})
