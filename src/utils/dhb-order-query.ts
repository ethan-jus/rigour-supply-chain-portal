import type { DhbOrderQuery } from '@/api/dhb'

/** 待处理订单使用订货宝 getOrderList 文档中的请求状态值。 */
export const DHB_PENDING_ORDER_STATUS = 'pricing,pending,stock_up,shipped,received'

export type DhbOrderPageKey =
  | 'order-list'
  | 'order-all'
  | 'order-pending'
  | 'order-exceptions'
  | 'order-source-exceptions'

export interface DhbOrderQueryOptions {
  pageKey: DhbOrderPageKey
  begin: number
  step: number
  orderStatus?: string
  startDate?: string
  endDate?: string
  payStatus?: string
  apiStatus?: string
}

/** 将订单菜单视图转换成 Order Center 已支持的查询参数。 */
export function buildDhbOrderQuery(options: DhbOrderQueryOptions): DhbOrderQuery {
  const isExceptionPage = options.pageKey === 'order-exceptions' || options.pageKey === 'order-source-exceptions'
  const preset = {
    exceptionStatus: options.pageKey === 'order-all' ? 'all'
      : isExceptionPage ? 'T' : 'F',
    orderStatus: options.pageKey === 'order-pending' ? DHB_PENDING_ORDER_STATUS : '',
  }
  const query: DhbOrderQuery = {
    begin: options.begin,
    step: options.step,
    // 订货宝官方默认 apiStatus=F；全部订单必须显式传 all。
    apiStatus: options.apiStatus || 'all',
    exceptionStatus: preset.exceptionStatus,
  }
  const orderStatus = isExceptionPage ? '' : options.orderStatus || preset.orderStatus
  if (orderStatus) query.order_status_val = orderStatus
  if (options.startDate) query.starttime = `${options.startDate} 00:00:00`
  if (options.endDate) query.endtime = `${options.endDate} 23:59:59`
  if (!isExceptionPage && options.payStatus) query.payStatus = options.payStatus
  return query
}
