import { afterEach, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import UserView from '@/views/supply-chain/settings/UserView.vue'
import DepartmentSidebar from '@/components/supply/DepartmentSidebar.vue'
import { supplyAccessApi } from '@/api/core/supply-settings'
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 'admin' } }) }))
vi.mock('@/stores/supply-authorization', () => ({
  useSupplyAuthorizationStore: () => ({ can: () => false }),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => false }),
}))
vi.mock('@/stores/navigation', () => ({ useNavigationStore: () => ({ getNavigation: () => [] }) }))
vi.mock('@/api/core/supply-settings', () => ({
  supplySettingsApi: {},
  supplyAccessApi: {
    members: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    memberRoles: vi.fn().mockResolvedValue([]),
    references: vi.fn().mockResolvedValue([
      { key: '1', name: '总部', parentKey: null },
      { key: '2', name: '杭州', parentKey: '1' },
    ]),
  },
}))
let wrapper: VueWrapper
it('用户列表复用部门树并把父部门过滤传给后端', async () => {
  wrapper = mount(UserView, {
    global: {
      plugins: [createPinia(), ElementPlus],
      stubs: {
        MemberCustomersDrawer: true,
        RoleAssignmentEditor: true,
        ScopeReferencePicker: true,
        ElDrawer: true,
        ElDialog: true,
      },
    },
  })
  await flushPromises()
  expect(supplyAccessApi.references).toHaveBeenCalledWith('DEPARTMENT')
  wrapper.getComponent(DepartmentSidebar).vm.$emit('update:modelValue', 1)
  await flushPromises()
  expect(supplyAccessApi.members).toHaveBeenLastCalledWith('', 1, 20, 1)
  wrapper.getComponent(DepartmentSidebar).vm.$emit('update:modelValue', null)
  await flushPromises()
  expect(supplyAccessApi.members).toHaveBeenLastCalledWith('', 1, 20, undefined)
})
afterEach(() => wrapper?.unmount())
