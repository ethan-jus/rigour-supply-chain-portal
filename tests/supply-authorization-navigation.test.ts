import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNavigationStore } from '@/stores/navigation'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import type { SupplyContext } from '@/api/core/supply-settings'

const { get, context } = vi.hoisted(() => ({ get: vi.fn(), context: vi.fn() }))
vi.mock('@/api', () => ({ apiClient: { get } }))
vi.mock('@/api/core/supply-settings', () => ({ supplySettingsApi: { context } }))
const page = { id: 'users', parentId: null, code: 'users', type: 'PAGE' as const, displayName: '用户管理',
  permissionCode: 'supply:user:read', routeKey: 'supply.settings.users', routePath: '/supply-chain/settings/users',
  iconKey: null, sortOrder: 1, visible: true, keepAlive: false, children: [] }
const oldContext: SupplyContext = { initialized: true, canInitialize: false, mode: 'PREPARING', version: 21, permissions: ['supply:user:read'] }
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks()
  const navigation = useNavigationStore()
  navigation.navigationByApplication.SUPPLY_CHAIN = [page]
  navigation.loadedApplications.push('SUPPLY_CHAIN')
  useSupplyAuthorizationStore().context = { ...oldContext }
})

describe('保存用户或角色后同步刷新菜单', () => {
  it('授权版本变化后无需页面跳转即可重新加载菜单', async () => {
    context.mockResolvedValue({ ...oldContext, version: 22 })
    get.mockResolvedValue([page])
    await useSupplyAuthorizationStore().refresh()
    expect(get).toHaveBeenCalledWith('/scdp/navigation', { deferSessionRecovery: true })
    expect(useNavigationStore().getNavigation('SUPPLY_CHAIN')).toEqual([page])
    expect(useNavigationStore().isLoaded('SUPPLY_CHAIN')).toBe(true)
  })
  it('加载失败向调用方报错，下次刷新相同版本仍会重试', async () => {
    context.mockResolvedValue({ ...oldContext, version: 22 })
    get.mockRejectedValueOnce(new Error('菜单服务暂不可用')).mockResolvedValueOnce([page])
    await expect(useSupplyAuthorizationStore().refresh()).rejects.toThrow('菜单服务暂不可用')
    expect(useNavigationStore().isLoaded('SUPPLY_CHAIN')).toBe(false)
    await useSupplyAuthorizationStore().refresh()
    expect(useNavigationStore().getNavigation('SUPPLY_CHAIN')).toEqual([page])
    expect(get).toHaveBeenCalledTimes(2)
  })
  it('服务端确实撤销了全部菜单时清除旧导航', async () => {
    context.mockResolvedValue({ ...oldContext, version: 22, permissions: [] })
    get.mockResolvedValue([])
    await useSupplyAuthorizationStore().refresh()
    expect(useNavigationStore().getNavigation('SUPPLY_CHAIN')).toEqual([])
    expect(useNavigationStore().isLoaded('SUPPLY_CHAIN')).toBe(true)
    expect(useSupplyAuthorizationStore().can('supply:user:read')).toBe(false)
  })
  it('授权版本未变化时不重复请求菜单', async () => {
    context.mockResolvedValue(oldContext)
    await useSupplyAuthorizationStore().refresh()
    expect(get).not.toHaveBeenCalled()
    expect(useNavigationStore().getNavigation('SUPPLY_CHAIN')).toEqual([page])
  })
})
