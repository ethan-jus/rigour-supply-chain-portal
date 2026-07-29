import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LoginRequest, UserInfo } from '@/types'
import { apiClient } from '@/api'
import { getToken, setToken, removeToken, setRefreshToken } from '@/utils/token'
import { usePermissionStore } from './permission'

/**
 * 认证 Store
 *
 * 职责：
 * - 管理用户登录状态、当前用户信息、token
 * - 提供 hasPermission / hasRole 权限判定方法
 * - 登录/获取用户信息后触发权限路由初始化
 *
 * 边界：
 * - token 存取委托给 utils/token.ts（隔离存储实现）
 * - 权限路由初始化委托给 permissionStore.initRoutes()
 * - 不处理 token 过期刷新逻辑（待接入后端 refresh 接口）
 *
 * 风险：
 * - localStorage 存储 token 受 XSS 影响，生产应迁移至 HttpOnly Cookie
 * - fetchUser 失败会导致菜单为空，已通过 catch 中的 logout 处理
 */

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const token = ref<string | null>(getToken())
  const isAuthenticated = ref(!!getToken())

  async function login(credentials: LoginRequest) {
    const result = (await apiClient.post('/auth/login', credentials)) as {
      accessToken: string
      refreshToken?: string
    }
    setToken(result.accessToken)
    if (result.refreshToken) {
      setRefreshToken(result.refreshToken)
    }
    token.value = result.accessToken
    isAuthenticated.value = true
    await fetchUser()
  }

  /**
   * 获取当前用户信息并初始化权限路由
   *
   * 成功后调用 permissionStore.initRoutes(user.permissions) 生成菜单树。
   * 这是登录、页面刷新恢复会话的统一入口。
   */
  async function fetchUser() {
    const userData = (await apiClient.get('/auth/me')) as UserInfo
    user.value = userData

    // 租户上下文仅保留在当前浏览器会话，供后续 API 请求注入可信租户头。
    sessionStorage.setItem('portal_tenant_id', userData.tenantId)

    // 根据用户权限初始化侧边菜单
    const permissionStore = usePermissionStore()
    permissionStore.initRoutes(userData.permissions)
  }

  function logout() {
    removeToken()
    token.value = null
    user.value = null
    isAuthenticated.value = false
    sessionStorage.removeItem('portal_tenant_id')

    // 清空菜单状态
    const permissionStore = usePermissionStore()
    permissionStore.reset()
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
    fetchUser,
    logout,
    hasPermission,
    hasRole,
  }
})
