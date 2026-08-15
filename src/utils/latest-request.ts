/**
 * 为可能并发的页面查询生成单调递增标识。
 *
 * 路由复用同一组件时，旧页面的慢响应不得覆盖新页面状态。
 */
export function createLatestRequestGuard() {
  let latest = 0

  return {
    begin() {
      latest += 1
      return latest
    },
    isCurrent(request: number) {
      return request === latest
    },
    invalidate() {
      latest += 1
    },
  }
}
