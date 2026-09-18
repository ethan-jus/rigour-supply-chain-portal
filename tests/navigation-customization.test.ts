import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNavigationStore } from '@/stores/navigation'
const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api', () => ({ apiClient: { get } }))
describe('saved navigation customization', () => {
  beforeEach(() => { setActivePinia(createPinia()); get.mockReset() })
  it('uses saved names verbatim including previously hardcoded supply routes', async () => {
    get.mockResolvedValue([{ id: 'p', parentId: null, code: 'p', type: 'PAGE', displayName: '华东客户档案',
      permissionCode: null, routeKey: 'supply.crm.customers.profiles', routePath: '/supply-chain/crm/customers/profiles',
      iconKey: 'User', sortOrder: 2, visible: true, keepAlive: false, children: [] }])
    const store = useNavigationStore()
    await store.fetchNavigation('SUPPLY_CHAIN')
    expect(store.getNavigation('SUPPLY_CHAIN')[0].displayName).toBe('华东客户档案')
    store.loadedApplications.push('SYSTEM_ADMIN')
    store.invalidate('SUPPLY_CHAIN')
    expect(store.getNavigation('SUPPLY_CHAIN')).toEqual([])
    expect(store.isLoaded('SUPPLY_CHAIN')).toBe(false)
    expect(store.isLoaded('SYSTEM_ADMIN')).toBe(true)
  })

  it('隐藏的未注册资源不再阻断菜单，也不能成为可访问路径', async () => {
    const base = { id: 'p', parentId: null, code: 'p', type: 'PAGE', displayName: '系统设置',
      permissionCode: null, iconKey: null, sortOrder: 0, keepAlive: false, children: [] }
    get.mockResolvedValue([
      { ...base, routeKey: 'supply.settings.menus', routePath: '/supply-chain/settings/menus', visible: true },
      { ...base, id: 'legacy', routeKey: 'supply.erp.master-data.sync', routePath: '/supply-chain/erp/master-data/sync', visible: false },
    ])
    const store = useNavigationStore()
    await store.fetchNavigation('SUPPLY_CHAIN')
    expect(store.isLoaded('SUPPLY_CHAIN')).toBe(true)
    expect(store.hasPath('SUPPLY_CHAIN', '/supply-chain/settings/menus')).toBe(true)
    expect(store.hasPath('SUPPLY_CHAIN', '/supply-chain/erp/master-data/sync')).toBe(false)
  })
})
