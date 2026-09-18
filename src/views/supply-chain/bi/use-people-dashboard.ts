import { displayDateTime } from '@/utils/business-date'
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import type { EmployeeAnalyticsQuery } from '@/api/core/bi-employees'
/** 筛选切换立即清除旧范围，过期请求不得覆盖新范围或已卸载的页面。 */
export function usePeopleDashboard<T>(fetcher: (query: EmployeeAnalyticsQuery) => Promise<T>) {
  const data = shallowRef<T | null>(null),
    loading = ref(false),
    error = ref('')
  let sequence = 0
  onBeforeUnmount(() => {
    sequence++
  })
  async function load(query: EmployeeAnalyticsQuery) {
    const request = ++sequence
    data.value = null
    error.value = ''
    loading.value = true
    try {
      const result = await fetcher(query)
      if (sequence === request) data.value = result
    } catch (reason) {
      if (sequence === request)
        error.value = reason instanceof Error ? reason.message : '数据加载失败，请重试'
    } finally {
      if (sequence === request) loading.value = false
    }
  }
  return { data, loading, error, load }
}
export const snapshotTime = (value: string | null) => (value ? displayDateTime(value) : '尚未同步')
