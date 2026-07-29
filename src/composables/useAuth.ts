import { computed } from 'vue'
import { useAuthStore } from '@/stores'

/**
 * useAuth 组合式函数
 *
 * 职责：提供组件内便捷的认证状态访问。
 *
 * 边界：不执行副作用（登录/登出），所有写操作通过 authStore。
 */
export function useAuth() {
  const authStore = useAuthStore()

  const isAdmin = computed(() => authStore.hasRole('super_admin'))
  const userName = computed(() => authStore.user?.displayName || '')
  const userRoles = computed(() => authStore.user?.roles || [])
  const userPermissions = computed(() => authStore.user?.permissions || [])

  return {
    isAdmin,
    userName,
    userRoles,
    userPermissions,
    hasPermission: authStore.hasPermission,
    hasRole: authStore.hasRole,
  }
}
