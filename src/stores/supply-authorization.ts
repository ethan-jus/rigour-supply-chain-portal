import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supplySettingsApi, type SupplyContext } from '@/api/core/supply-settings'
import { useNavigationStore } from '@/stores/navigation'

/** 当前租户的 SCDP 授权；版本变化时重新加载菜单。 */
export const useSupplyAuthorizationStore = defineStore('supply-authorization', () => {
  const context = ref<SupplyContext | null>(null)
  function can(action: string) { return context.value?.permissions.includes(action) === true }
  async function refresh() {
    const next = await supplySettingsApi.context()
    if (context.value?.version !== next.version || context.value?.initialized !== next.initialized) {
      const navigation = useNavigationStore()
      navigation.invalidate('SUPPLY_CHAIN')
      // 保存用户/角色后仍停留在当前页，不能依赖下一次路由跳转补载菜单。
      await navigation.fetchNavigation('SUPPLY_CHAIN', { deferSessionRecovery: true })
    }
    context.value = next
    return next
  }
  async function initialize() {
    context.value = await supplySettingsApi.initialize()
    useNavigationStore().invalidate('SUPPLY_CHAIN')
    await useNavigationStore().fetchNavigation('SUPPLY_CHAIN')
  }
  function reset() { context.value = null }
  return { context, can, refresh, initialize, reset }
})
