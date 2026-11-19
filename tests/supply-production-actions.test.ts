import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import SupplyActionLabel from '@/components/supply/SupplyActionLabel.vue'

beforeEach(() => setActivePinia(createPinia()))

it('uses the current role grant and the menu editor label, including revocation', async () => {
  const access = useSupplyAuthorizationStore()
  const auth = useAuthStore()
  auth.user = { id: 'employee', tenantId: 'tenant', tenantName: '企业', principalScope: 'TENANT', username: 'user',
    displayName: '用户', roles: [], permissions: ['hr:department:delete', 'erp:product:write'] }
  const view = defineComponent({
    components: { SupplyActionLabel },
    setup: useSupplyPermissions,
    template: `<button v-if="can('hr:department:delete')"><SupplyActionLabel code="hr:department:delete" fallback="删除" /></button>`,
  })
  access.context = { initialized: true, canInitialize: false, version: 1, mode: 'ACTIVE', permissions: [] }
  const wrapper = mount(view)
  expect(wrapper.find('button').exists()).toBe(false)
  expect(auth.hasPermission('erp:product:write')).toBe(false)
  const codes = ['hr:department:delete']
  access.context = { ...access.context, version: 2, permissions: codes, actionLabels: { [codes[0]!]: '删除部门记录' } }
  await nextTick()
  expect(wrapper.get('button').text()).toBe('删除部门记录')
  expect(auth.user?.permissions).toEqual(codes)
  access.context = { ...access.context, version: 3, permissions: [], actionLabels: {} }
  await nextTick()
  expect(wrapper.find('button').exists()).toBe(false)
  expect(auth.hasPermission(codes[0]!)).toBe(false)
  wrapper.unmount()
})
