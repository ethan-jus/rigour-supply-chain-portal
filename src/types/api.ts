/** 标准成功响应 */
export interface ApiResponse<T = unknown> {
  code: string
  message: string
  data?: T
  details?: { field?: string; code?: string; message: string }[]
  requestId: string
  timestamp: string
}
