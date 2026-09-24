/**
 * 错误处理模块
 *
 * 职责：
 * - 维护可识别的后端业务错误码到中文消息的映射
 *
 * 边界：错误码映射只含已在 API 契约中约定的码；
 * 未映射的码使用 fallback 消息或后端原始 message。
 */

/** 业务错误码 → 用户可见消息 */
const ERROR_MESSAGES: Record<string, string> = {
  IAM_FORBIDDEN: '无权访问当前数据范围',
  IAM_TOKEN_INVALID: '登录已过期，请重新登录',
  IAM_UNAUTHORIZED: '登录已过期，请重新登录',
  IAM_INVALID_TOKEN: '无效的访问令牌',
  IAM_SESSION_CHECK_UNAVAILABLE: '身份服务暂时不可用，请稍后重试',
  IAM_TENANT_MISMATCH: '租户信息不匹配',
  TRUSTED_CONTEXT_INVALID: '当前业务服务身份校验失败，请稍后重试',
  VALIDATION_ERROR: '请求参数校验失败',
  RATE_LIMITED: '请求过于频繁，请稍后重试',
  SERVICE_UNAVAILABLE: '服务暂不可用，请稍后重试',
  INTERNAL_ERROR: '服务器内部错误',
  NETWORK_ERROR: '网络连接失败，请检查网络后重试',
  REQUEST_TIMEOUT: '请求超时，请稍后重试',
}

/**
 * 解析后端错误消息
 * @param code - 后端返回的错误码
 * @param fallback - 未映射时的回退文本
 */
export function getErrorMessage(code: string, fallback?: string): string {
  if (code === 'VALIDATION_ERROR' && fallback) return fallback
  return ERROR_MESSAGES[code] ?? fallback ?? `未知错误 (${code})`
}

/** API 拒绝值也可能是普通对象，不能只读取 Error 实例。 */
export function errorMessage(reason: unknown, fallback: string): string {
  if (!reason || typeof reason !== 'object') return fallback
  const failure = reason as { code?: string; message?: string; details?: { message?: string }[] }
  const details = Array.isArray(failure.details)
    ? failure.details.map(detail => detail?.message).filter(Boolean).join('；') : ''
  if (details && ['VALIDATION_ERROR', 'VALIDATION_FAILED'].includes(failure.code || '')) return details
  return failure.code ? getErrorMessage(failure.code, failure.message || fallback) : failure.message || fallback
}

const HTTP_ERRORS: Record<number, [string, string]> = {
  400: ['BAD_REQUEST', '请求参数无效，请检查填写内容'],
  401: ['BUSINESS_UNAUTHORIZED', '当前请求未通过身份校验'],
  403: ['FORBIDDEN', '没有执行该操作的权限'],
  404: ['NOT_FOUND', '请求的资源不存在或已删除'],
  405: ['METHOD_NOT_ALLOWED', '请求方式不支持'],
  409: ['CONFLICT', '数据已变化，请刷新后重试'],
  413: ['PAYLOAD_TOO_LARGE', '上传文件或请求内容超过大小限制'],
  415: ['UNSUPPORTED_MEDIA_TYPE', '请求内容格式不支持'],
  422: ['VALIDATION_FAILED', '请检查填写内容'],
  429: ['RATE_LIMITED', '请求过于频繁，请稍后重试'],
  500: ['INTERNAL_ERROR', '服务器处理失败，请稍后重试'],
  502: ['BAD_GATEWAY', '业务服务暂时无法连接，请稍后重试'],
  503: ['SERVICE_UNAVAILABLE', '服务暂不可用，请稍后重试'],
  504: ['GATEWAY_TIMEOUT', '业务服务响应超时，请稍后重试'],
}

interface FailureBody {
  code?: string
  message?: string
  requestId?: string
  timestamp?: string
  details?: { field?: string; code?: string; message?: string }[]
}

/** 页面统一接收 Error，既可读取 message，也可按 HTTP 状态/业务码处理。 */
export class ApiError extends Error {
  readonly code: string
  readonly status?: number
  readonly requestId: string
  readonly timestamp: string
  readonly details: NonNullable<FailureBody['details']>
  readonly response?: { status: number }
  readonly silent: boolean

  constructor(body: FailureBody, status?: number, requestId = '', transportCode?: string, silent = false) {
    const timeout = ['ECONNABORTED', 'ETIMEDOUT'].includes(transportCode || '')
    const fallback = status
      ? HTTP_ERRORS[status] || ['HTTP_ERROR', `请求失败（HTTP ${status}），请稍后重试`]
      : timeout ? ['REQUEST_TIMEOUT', '请求超时，请稍后重试'] : ['NETWORK_ERROR', '网络连接失败，请检查网络后重试']
    const code = body.code || fallback[0]!
    const message = status && status >= 500
      ? getErrorMessage(code, fallback[1])
      : getErrorMessage(code, body.message || fallback[1])
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.requestId = body.requestId || requestId
    this.timestamp = body.timestamp || new Date().toISOString()
    this.details = Array.isArray(body.details) ? body.details.filter(detail => detail && typeof detail.message === 'string') : []
    this.response = status ? { status } : undefined
    this.silent = silent
  }
}
