import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse } from '@/types'
import { getAuthorizationHeader, removeToken } from '@/utils/token'
import { ensureAccessToken, getSessionGeneration, hasRefreshToken, TokenRefreshError } from '@/auth/oidc'
import { generateRequestId } from '@/utils/request-id'
import { devInfo, devWarn } from '@/utils/dev-log'
import { getErrorMessage } from './error'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** 无明确Token失效marker的业务401保留页面。 */
    stayOnUnauthorized?: boolean
    /** 由路由守卫根据to.fullPath处理会话失效，API层只返回结构化错误。 */
    deferSessionRecovery?: boolean
    /** 仅供会话复核请求使用，防止/me 401递归触发恢复。 */
    skipSessionRecovery?: boolean
    /** 同一请求最多在刷新成功后重试一次。 */
    tokenRefreshRetried?: boolean
    tokenSessionGeneration?: number
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

type ReadMethod = 'get' | 'delete' | 'head' | 'options'
type WriteMethod = 'post' | 'put' | 'patch' | 'postForm' | 'putForm' | 'patchForm' | 'query'
type BodyRead = <T = unknown, R = T, D = unknown>(url: string, config?: AxiosRequestConfig<D>) => Promise<R>
type BodyWrite = <T = unknown, R = T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) => Promise<R>

interface TransformingResponseInterceptors<Input, Failure = unknown> {
  use(onFulfilled?: ((value: Input) => unknown) | null, onRejected?: ((error: Failure) => unknown) | null): number
  eject(id: number): void
  clear(): void
}

/** This instance returns unwrapped business bodies; ordinary Axios instances keep AxiosResponse. */
export type ApiClient = Omit<AxiosInstance, ReadMethod | WriteMethod | 'request' | 'interceptors'> & {
  <T = unknown, R = T, D = unknown>(config: AxiosRequestConfig<D>): Promise<R>
  <T = unknown, R = T, D = unknown>(url: string, config?: AxiosRequestConfig<D>): Promise<R>
  request<T = unknown, R = T, D = unknown>(config: AxiosRequestConfig<D>): Promise<R>
  interceptors: {
    request: AxiosInstance['interceptors']['request']
    response: TransformingResponseInterceptors<unknown>
  }
} & Record<ReadMethod, BodyRead> & Record<WriteMethod, BodyWrite>

export interface UnauthorizedSessionContext {
  code: string
  requestId: string
  requestUrl: string
}

type UnauthorizedSessionHandler = (context: UnauthorizedSessionContext) => void | Promise<void>

let unauthorizedSessionHandler: UnauthorizedSessionHandler | null = null
let unauthorizedSessionNotification: Promise<void> | null = null
let currentSessionProbe: Promise<boolean> | null = null

const SESSION_INVALID_MARKERS = new Set([
  'IAM_TOKEN_INVALID',
  'IAM_UNAUTHORIZED',
  'IAM_INVALID_TOKEN',
])
const AUTH_FAILURE_HEADER = 'x-rigour-auth-failure'

/**
 * 注册全局401会话失效处理器。
 *
 * API层只负责识别服务端已经拒绝当前凭证；具体的用户、应用、菜单和权限状态
 * 由认证Store统一清理，避免只删除Token后留下“页面仍显示已登录”的脏状态。
 */
export function registerUnauthorizedSessionHandler(handler: UnauthorizedSessionHandler): () => void {
  unauthorizedSessionHandler = handler
  unauthorizedSessionNotification = null
  currentSessionProbe = null
  return () => {
    if (unauthorizedSessionHandler === handler) {
      unauthorizedSessionHandler = null
      unauthorizedSessionNotification = null
      currentSessionProbe = null
    }
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

interface UnauthorizedFailure {
  code: string
  message: string
  requestId: string
  timestamp: string
  response?: AxiosResponse
}

function responseMarker(error: AxiosError<ApiResponse>): string | undefined {
  const headers = error.response?.headers
  const headerValue = typeof headers?.get === 'function'
    ? headers.get(AUTH_FAILURE_HEADER)
    : headers?.[AUTH_FAILURE_HEADER]
  if (typeof headerValue === 'string' && headerValue.trim()) return headerValue.trim()
  const bodyCode = error.response?.data?.code
  return typeof bodyCode === 'string' && bodyCode.trim() ? bodyCode.trim() : undefined
}

function isIamSessionEndpoint(value: string | undefined): boolean {
  if (!value) return false
  try {
    const path = new URL(value, window.location.origin).pathname.replace(/^\/api\/v1(?=\/|$)/, '')
    return path === '/me' || path === '/scdp/navigation' || path === '/management/supply/context'
  } catch {
    return false
  }
}

function unauthorizedFailure(
  error: AxiosError<ApiResponse>, marker?: string, codeOverride?: string,
): UnauthorizedFailure {
  const requestId = error.config?.headers?.['X-Request-Id']
  const body = error.response?.data
  const code = codeOverride || marker || 'BUSINESS_UNAUTHORIZED'
  return {
    code,
    message: body?.message
      ? getErrorMessage(code, body.message)
      : '当前业务接口暂时无法访问，请稍后重试；如持续出现，请提供请求 ID 排查',
    requestId: requestId ? String(requestId) : '',
    timestamp: body?.timestamp || new Date().toISOString(),
    response: error.response,
  }
}

function isSessionInvalidFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const failure = error as { code?: string; response?: { status?: number } }
  if (typeof failure.code === 'string' && failure.code) {
    return SESSION_INVALID_MARKERS.has(failure.code)
  }
  return failure.response?.status === 401
}

async function notifySessionInvalid(context: UnauthorizedSessionContext): Promise<void> {
  if (!unauthorizedSessionNotification) {
    unauthorizedSessionNotification = (async () => {
      try {
        if (unauthorizedSessionHandler) await unauthorizedSessionHandler(context)
        else removeToken()
      } catch (error) {
        devWarn('会话失效恢复处理失败，仅清理内存Token', {
          message: error instanceof Error ? error.message : error,
        })
        removeToken()
      }
    })()
  }
  await unauthorizedSessionNotification
}

async function probeCurrentSession(): Promise<boolean> {
  if (!currentSessionProbe) {
    currentSessionProbe = apiClient.get('/me', { skipSessionRecovery: true })
      .then(() => true)
      .catch((error: unknown) => !isSessionInvalidFailure(error))
      .finally(() => { currentSessionProbe = null })
  }
  return currentSessionProbe
}
/**
 * 创建 Axios 实例
 *
 * 职责：
 * - 注入 Authorization（Bearer token）
 * - 不接受浏览器注入租户身份头；Gateway只从已验签JWT重建可信上下文
 * - 注入 X-Request-Id（每次请求生成唯一追踪 ID）
 * - 统一解包 ApiResponse，提取 data 或 reject 非 OK 响应
 * - 仅稳定IAM Token失效marker触发集中会话恢复
 * - trusted-context和业务401保留当前页面，无marker时single-flight复核/me
 *
 * 边界：不包含业务判定逻辑；错误码映射在 error.ts 维护。
 * 双 Token 仅保存在页面内存；运行期间标准刷新，重载页面才通过 IAM 会话重新授权。
 */
function createClient(): ApiClient {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'zh-CN',
    },
  })

  /** 请求拦截器：注入认证、租户、追踪头 */
  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    config.tokenSessionGeneration ??= getSessionGeneration()
    try {
      await ensureAccessToken()
      if (config.tokenSessionGeneration !== getSessionGeneration()) {
        throw new TokenRefreshError('REQUEST_CANCELLED', '会话已变更')
      }
    } catch (error) {
      if (error instanceof TokenRefreshError && error.code === 'IAM_TOKEN_INVALID'
        && !config.deferSessionRecovery && !config.skipSessionRecovery) {
        await notifySessionInvalid({ code: error.code, requestId: '', requestUrl: config.url || '' })
      }
      throw error
    }
    const authorization = getAuthorizationHeader()
    if (authorization) {
      config.headers.Authorization = authorization
    } else {
      config.headers.delete('Authorization')
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
  // Axios's declarations assume every response interceptor preserves AxiosResponse.
  // Only this first interceptor receives the transport response and changes the public result.
  const responseInterceptors = client.interceptors.response as TransformingResponseInterceptors<AxiosResponse<unknown>, AxiosError<ApiResponse>>
  responseInterceptors.use(
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
    async (error: AxiosError<ApiResponse>) => {
      if (error instanceof TokenRefreshError) return Promise.reject(error)
      if (error.config?.tokenSessionGeneration !== undefined
        && error.config.tokenSessionGeneration !== getSessionGeneration()) {
        return Promise.reject(new TokenRefreshError('REQUEST_CANCELLED', '会话已变更'))
      }
      const requestId = error.config?.headers?.['X-Request-Id']
      const marker = responseMarker(error)
      devWarn('接口请求失败', {
        requestId,
        status: error.response?.status,
        code: marker,
        url: error.config?.url,
      })

      if (error.response?.status === 401) {
        if (error.config?.skipSessionRecovery) {
          // /me兼容复核的裸401没有显式marker，仍需视为会话失效；
          // 若已有TRUSTED_CONTEXT_INVALID等marker，则必须优先尊重服务端分类。
          return Promise.reject(unauthorizedFailure(
            error,
            marker,
            marker ? undefined : 'IAM_TOKEN_INVALID',
          ))
        }

        let sessionInvalid = marker ? SESSION_INVALID_MARKERS.has(marker) : false
        if (!sessionInvalid && error.config?.stayOnUnauthorized) {
          return Promise.reject(unauthorizedFailure(error, marker))
        }
        if (!marker && isIamSessionEndpoint(error.config?.url)) {
          sessionInvalid = true
        } else if (!marker) {
          sessionInvalid = !(await probeCurrentSession())
        }

        const failure = unauthorizedFailure(
          error,
          marker,
          sessionInvalid ? 'IAM_TOKEN_INVALID' : undefined,
        )
        if (sessionInvalid && error.config && !error.config.tokenRefreshRetried && hasRefreshToken()) {
          try {
            const rejected = String(error.config.headers.Authorization || '').replace(/^Bearer /i, '')
            const token = await ensureAccessToken(rejected)
            if (token) {
              error.config.tokenRefreshRetried = true
              return client.request(error.config)
            }
          } catch (refreshError) {
            if (!(refreshError instanceof TokenRefreshError) || refreshError.code !== 'IAM_TOKEN_INVALID') {
              return Promise.reject(refreshError)
            }
          }
        }
        if (sessionInvalid && !error.config?.deferSessionRecovery) {
          devWarn('IAM Access Token已失效，触发集中会话恢复', { requestId, url: error.config?.url })
          await notifySessionInvalid({
            code: failure.code,
            requestId: failure.requestId,
            requestUrl: error.config?.url || '',
          })
        }
        return Promise.reject(failure)
      }

      const errorBody = error.response?.data
      if (errorBody?.code) {
        const message = getErrorMessage(errorBody.code, errorBody.message)
        return Promise.reject({ ...errorBody, message })
      }

      // 后端稳定协议允许marker仅由响应头携带；保留Axios response
      // 供路由守卫区分IAM_FORBIDDEN与身份服务暂时不可用。
      if (marker) {
        return Promise.reject(unauthorizedFailure(error, marker))
      }

      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: error.message || '网络异常',
        requestId: requestId ? String(requestId) : '',
        timestamp: new Date().toISOString(),
      })
    },
  )

  return client as ApiClient
}

export const apiClient = createClient()
