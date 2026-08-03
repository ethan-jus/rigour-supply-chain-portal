/** 标准成功响应 */
export interface ApiResponse<T = unknown> {
  code: string
  message: string
  data: T
  requestId: string
  timestamp: string
}
