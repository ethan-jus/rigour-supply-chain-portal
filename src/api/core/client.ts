import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse } from '@/types'
import { getAuthorizationHeader, removeToken } from '@/utils/token'
import { generateRequestId } from '@/utils/request-id'
import { devInfo, devWarn } from '@/utils/dev-log'
import { getErrorMessage } from './error'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** 当前业务请求失败时保留页面，不触发全局会话跳转。 */
    stayOnUnauthorized?: boolean
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

type UnauthorizedSessionHandler = () => void

let unauthorizedSessionHandler: UnauthorizedSessionHandler | null = null

/**
 * 注册全局401会话失效处理器。
 *
 * API层只负责识别服务端已经拒绝当前凭证；具体的用户、应用、菜单和权限状态
 * 由认证Store统一清理，避免只删除Token后留下“页面仍显示已登录”的脏状态。
 */
export function registerUnauthorizedSessionHandler(handler: UnauthorizedSessionHandler): () => void {
  unauthorizedSessionHandler = handler
  return () => {
    if (unauthorizedSessionHandler === handler) unauthorizedSessionHandler = null
  }
}

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
 * - 认证请求的401自动清除token并跳转登录
 * - 业务请求可通过 stayOnUnauthorized 保留当前页面，由业务页面自行提示和重试
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
    const authorization = getAuthorizationHeader()
    if (authorization) {
      config.headers.Authorization = authorization
    }

    const requestId = generateRequestId()
    config.headers['X-Request-Id'] = requestId
    devInfo('接口请求开始', {
      requestId,
      method: config.method?.toUpperCase(),
      url: config.url,
    })

    return config
  })

  /** 响应拦截器：统一解包、错误处理 */
  client.interceptors.response.use(
    (response: AxiosResponse<unknown>) => {
      devInfo('接口请求完成', {
        requestId: response.config.headers?.['X-Request-Id'],
        status: response.status,
        url: response.config.url,
      })
      const body = response.data
      if (!isApiResponse(body)) return body
      if (body.code !== 'OK') {
        return Promise.reject(body)
      }
      return body.data
    },
    (error: AxiosError<ApiResponse>) => {
      const requestId = error.config?.headers?.['X-Request-Id']
      devWarn('接口请求失败', {
        requestId,
        status: error.response?.status,
        code: error.response?.data?.code,
        url: error.config?.url,
      })
      if (error.response?.status === 401 && !error.config?.stayOnUnauthorized) {
        devWarn('IAM返回401，清理本地会话并回到登录页', { requestId })
        if (unauthorizedSessionHandler) {
          unauthorizedSessionHandler()
        } else {
          // 应用尚未完成启动时仍要删除内存Token，不能保留已失效凭证。
          removeToken()
        }
        window.location.hash = '/login'
        return Promise.reject(error)
      }

      const errorBody = error.response?.data
      if (error.response?.status === 401 && error.config?.stayOnUnauthorized) {
        return Promise.reject({
          code: errorBody?.code || 'UNAUTHORIZED',
          message: errorBody?.code
            ? getErrorMessage(errorBody.code, errorBody.message)
            : '订单接口暂时无法访问，请检查订单服务配置后重试',
          requestId: requestId ? String(requestId) : '',
          timestamp: errorBody?.timestamp || new Date().toISOString(),
          response: error.response,
        })
      }

      if (errorBody?.code) {
        const message = getErrorMessage(errorBody.code, errorBody.message)
        return Promise.reject({ ...errorBody, message })
      }

      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: error.message || '网络异常',
        requestId: requestId ? String(requestId) : '',
        timestamp: new Date().toISOString(),
      })
    },
  )

  return client
}

export const apiClient = createClient()
