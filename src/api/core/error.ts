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
  IAM_UNAUTHORIZED: '登录已过期，请重新登录',
  IAM_INVALID_TOKEN: '无效的访问令牌',
  IAM_TENANT_MISMATCH: '租户信息不匹配',
  VALIDATION_ERROR: '请求参数校验失败',
  RATE_LIMITED: '请求过于频繁，请稍后重试',
  SERVICE_UNAVAILABLE: '服务暂不可用，请稍后重试',
  INTERNAL_ERROR: '服务器内部错误',
}

/**
 * 解析后端错误消息
 * @param code - 后端返回的错误码
 * @param fallback - 未映射时的回退文本
 */
export function getErrorMessage(code: string, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? `未知错误 (${code})`
}
