import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserInfo } from '@/types'
import { apiClient } from '@/api'
import { getToken, removeToken } from '@/utils/token'
import { beginOidcLogin, beginOidcLogout } from '@/auth/oidc'
import { usePermissionStore } from './permission'
import { useApplicationStore } from './application'
import { useNavigationStore } from './navigation'

/**
 * 认证 Store
 *
 * 职责：
 * - 发起OIDC Authorization Code + PKCE并管理内存Access Token
 * - 提供 hasPermission / hasRole 权限判定方法
 * - 登录/获取用户信息后触发权限路由初始化
 *
 * 边界：
 * - Token不进入localStorage/sessionStorage；PKCE临时材料只在sessionStorage中跨重定向保存
 * - 权限路由初始化委托给 permissionStore.initRoutes()
 * - 公开SPA不接收Refresh Token；页面刷新或Token失效后复用IAM会话重新授权
 *
 * 风险：
 * - fetchUser 失败会导致菜单为空，已通过 catch 中的 logout 处理
 */

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const token = ref<string | null>(getToken())
  const isAuthenticated = ref(!!getToken())

  async function login(returnPath = '/apps') {
    await beginOidcLogin(returnPath)
  }

  function synchronizeTokenState() {
    token.value = getToken()
    isAuthenticated.value = !!token.value
  }

  /**
   * 获取当前用户信息并初始化权限路由
   *
   * 成功后调用 permissionStore.initRoutes(user.permissions) 生成菜单树。
   * 这是登录、页面刷新恢复会话的统一入口。
   */
  async function fetchUser() {
    const userData = (await apiClient.get('/me')) as UserInfo
    user.value = userData

    // 根据用户权限初始化侧边菜单
    const permissionStore = usePermissionStore()
    permissionStore.initRoutes(userData.permissions)
  }

  function clearLocalSession() {
    removeToken()
    token.value = null
    user.value = null
    isAuthenticated.value = false
    // 清空菜单状态
    const permissionStore = usePermissionStore()
    permissionStore.reset()
    useApplicationStore().reset()
    useNavigationStore().reset()
  }

  function logout() {
    clearLocalSession()
    beginOidcLogout()
  }

  function hasPermission(permission: string): boolean {
    if (!user.value) return false
    if (user.value.permissions.includes('*:*:*')) return true
    return user.value.permissions.includes(permission)
  }

  function hasRole(role: string): boolean {
    if (!user.value) return false
    return user.value.roles.includes(role) || user.value.roles.includes('super_admin')
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    synchronizeTokenState,
    fetchUser,
    logout,
    clearLocalSession,
    hasPermission,
    hasRole,
  }
})
