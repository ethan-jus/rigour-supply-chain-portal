import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse } from '@/types'
import { getToken, removeToken } from '@/utils/token'
import { generateRequestId } from '@/utils/request-id'
import { getErrorMessage } from './error'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const ENABLE_MOCK = import.meta.env.VITE_ENABLE_MOCK === 'true'

/**
 * 获取当前租户 ID
 *
 * 优先级：URL 查询参数 > sessionStorage > 空字符串。
 * 生产环境不得硬编码默认租户；租户 ID 必须由认证响应或租户选择上下文覆盖。
 * sessionStorage 仅作为过渡方案，不持久化到 localStorage。
 */
function getTenantId(): string {
  // 从 URL 查询参数读取（用于租户切换后重定向）
  const urlParams = new URLSearchParams(window.location.search)
  const tenantFromUrl = urlParams.get('tenantId')
  if (tenantFromUrl) return tenantFromUrl

  // 从 sessionStorage 读取（当前会话的租户选择）
  const tenantFromSession = sessionStorage.getItem('portal_tenant_id')
  if (tenantFromSession) return tenantFromSession

  return ''
}

/**
 * 创建 Axios 实例
 *
 * 职责：
 * - 注入 Authorization（Bearer token）
 * - 注入 X-Tenant-Id（运行时从 URL/sessionStorage 获取）
 * - 注入 X-Request-Id（每次请求生成唯一追踪 ID）
 * - 统一解包 ApiResponse，提取 data 或 reject 非 OK 响应
 * - 401 自动清除 token 并跳转登录
 *
 * 边界：不包含业务判定逻辑；错误码映射在 error.ts 维护。
 * 风险：localStorage 存储 token 有 XSS 风险，生产环境应使用 HttpOnly/SameSite cookie。
 */
function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'zh-CN',
    },
  })

  /** 请求拦截器：注入认证、租户、追踪头 */
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    const tenantId = getTenantId()
    if (tenantId) {
      config.headers['X-Tenant-Id'] = tenantId
    }

    config.headers['X-Request-Id'] = generateRequestId()

    if (ENABLE_MOCK) {
      config.headers['X-Mock-Enabled'] = 'true'
    }

    return config
  })

  /** 响应拦截器：统一解包、错误处理 */
  client.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
      const body = response.data
      if (body.code && body.code !== 'OK') {
        return Promise.reject(body)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (body.data !== undefined ? body.data : body) as any
    },
    (error: AxiosError<ApiResponse>) => {
      if (error.response?.status === 401) {
        removeToken()
        // 应用使用 Hash Router，只更新 hash 可保留子路径部署前缀。
        window.location.hash = '/login'
        return Promise.reject(error)
      }

      const errorBody = error.response?.data
      if (errorBody?.code) {
        const message = getErrorMessage(errorBody.code, errorBody.message)
        return Promise.reject({ ...errorBody, message })
      }

      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: error.message || '网络异常',
        requestId: '',
        timestamp: new Date().toISOString(),
      })
    },
  )

  return client
}

export const apiClient = createClient()
