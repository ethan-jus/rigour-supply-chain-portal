import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse } from '@/types'
import { getToken, removeToken } from '@/utils/token'
import { generateRequestId } from '@/utils/request-id'
import { getErrorMessage } from './error'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

function isApiResponse(value: unknown): value is ApiResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.code === 'string'
    && typeof candidate.message === 'string'
    && typeof candidate.requestId === 'string'
    && typeof candidate.timestamp === 'string'
    && 'data' in candidate
}
/**
 * 创建 Axios 实例
 *
 * 职责：
 * - 注入 Authorization（Bearer token）
 * - 不接受浏览器注入租户身份头；Gateway只从已验签JWT重建可信上下文
 * - 注入 X-Request-Id（每次请求生成唯一追踪 ID）
 * - 统一解包 ApiResponse，提取 data 或 reject 非 OK 响应
 * - 401 自动清除 token 并跳转登录
 *
 * 边界：不包含业务判定逻辑；错误码映射在 error.ts 维护。
 * Access Token仅在当前页面内存中保存；刷新页面后通过IAM会话重新授权。
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

    config.headers['X-Request-Id'] = generateRequestId()

    return config
  })

  /** 响应拦截器：统一解包、错误处理 */
  client.interceptors.response.use(
    (response: AxiosResponse<unknown>) => {
      const body = response.data
      if (!isApiResponse(body)) return body
      if (body.code !== 'OK') {
        return Promise.reject(body)
      }
      return body.data
    },
    (error: AxiosError<ApiResponse>) => {
      if (error.response?.status === 401) {
        removeToken()
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
