/** API failures may be structured response bodies instead of Error instances. */
export function biNeedsLogin(failure: unknown): boolean {
  if (!failure || typeof failure !== 'object') return false
  if ('code' in failure && failure.code === 'UNAUTHORIZED') return true
  return (
    'response' in failure &&
    !!failure.response &&
    typeof failure.response === 'object' &&
    'status' in failure.response &&
    failure.response.status === 401
  )
}

export function biErrorMessage(failure: unknown, fallback: string): string {
  if (
    failure && typeof failure === 'object' && 'code' in failure &&
    ['NETWORK_ERROR', 'ECONNABORTED', 'ETIMEDOUT'].includes(String(failure.code))
  ) {
    return '连接中断或请求超时，本次请求结果尚未确认。请稍后刷新记录确认结果，再按需重试；不要重复导入业务数据。'
  }
  if (
    failure &&
    typeof failure === 'object' &&
    'code' in failure &&
    failure.code === 'SERVICE_UNAVAILABLE' &&
    'details' in failure &&
    Array.isArray(failure.details)
  ) {
    if (
      failure.details.some((detail) => detail?.reason === 'BI_ONLINE_SOURCE_READ_NOT_PROVISIONED')
    ) {
      return 'BI 服务尚未配置在线采集来源的只读权限。请联系管理员补齐授权后，重试已采集版本的复核。'
    }
    if (
      failure.details.some((detail) => detail?.reason === 'BI_PRODUCT_UNIT_DICTIONARY_UNAVAILABLE')
    ) {
      return '商品单位字典暂不可用。请检查业务字典服务后，重试已采集版本的复核；无需重新采集或导入订单。'
    }
  }
  if (failure && typeof failure === 'object' && 'message' in failure) {
    const message = failure.message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}
