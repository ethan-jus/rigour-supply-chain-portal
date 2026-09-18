import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserInfo } from '@/types'
import { apiClient } from '@/api'
import { getToken, removeToken } from '@/utils/token'
import { beginOidcLogin, hasRefreshToken } from '@/auth/oidc'
import { logoutBrowserSession } from '@/auth/browser-session'
import { ElMessage } from 'element-plus'
import { useNavigationStore } from './navigation'
import { useSupplyAuthorizationStore } from './supply-authorization'
import { devInfo, devWarn } from '@/utils/dev-log'
import { setBusinessDictionaryTenant, clearBusinessDictionaries } from '@/utils/business-dictionary'

/** SCDP 登录会话；Token 只保存在内存，业务授权由供应链权限上下文提供。 */

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const token = ref<string | null>(getToken())
  const isAuthenticated = ref(!!getToken() || hasRefreshToken())

  async function login() {
    await beginOidcLogin()
  }

  function synchronizeTokenState() {
    token.value = getToken()
    isAuthenticated.value = !!token.value || hasRefreshToken()
  }

  /** SCDP 登录会话；Token 只保存在内存，业务授权由供应链权限上下文提供。 */
  async function fetchUser(options: { deferSessionRecovery?: boolean } = {}) {
    devInfo('开始恢复当前用户会话')
    try {
      const userData = (await apiClient.get('/me', {
        deferSessionRecovery: options.deferSessionRecovery,
      })) as UserInfo
      setBusinessDictionaryTenant(userData.tenantId)
      user.value = userData

      devInfo('当前用户会话恢复成功', {
        principalScope: userData.principalScope,
        tenantId: userData.tenantId,
        rolesCount: userData.roles.length,
        permissionsCount: userData.permissions.length,
      })
    } catch (error) {
      devWarn('当前用户会话恢复失败', {
        code: typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string }).code : undefined,
        status: typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status : undefined,
      })
      throw error
    }
  }

  function clearLocalSession() {
    removeToken()
    token.value = null
    user.value = null
    isAuthenticated.value = false
    // 清空菜单状态
    useNavigationStore().reset()
    useSupplyAuthorizationStore().reset()
    clearBusinessDictionaries()
    setBusinessDictionaryTenant(null)
  }

  let loggingOut = false
  async function logout() {
    if (loggingOut) return
    loggingOut = true
    try {
      await logoutBrowserSession()
    } catch {
      ElMessage.error('退出未完成，登录服务暂时不可用，请稍后重试。')
      return
    } finally {
      loggingOut = false
    }
    clearLocalSession()
    window.location.hash = '/login?reason=logout'
  }

  function hasPermission(permission: string): boolean {
    if (!user.value) return false
    return user.value.permissions.includes(permission)
  }

  function hasRole(role: string): boolean {
    if (!user.value) return false
    return user.value.roles.includes(role)
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
