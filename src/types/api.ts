/** 标准成功响应 */
export interface ApiResponse<T = unknown> {
  code: string
  message: string
  data: T
  requestId: string
  timestamp: string
}

/** 分页请求参数 */
export interface PaginationParams {
  page?: number
  pageSize?: number
  sort?: string
}

/** 分页响应数据 */
export interface PaginatedData<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

/** 列表查询参数 */
export interface ListParams extends PaginationParams {
  [key: string]: unknown
}
