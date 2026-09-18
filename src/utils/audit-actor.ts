import { reactive } from 'vue'
import { apiClient } from '@/api/core/client'
import { getAuthorizationHeader } from '@/utils/token'

const systemActors = new Set(['SYSTEM', 'DHB_SYNC', '019FB700-0000-7000-8000-00000000D0B0'])
const names = reactive(new Map<string, string>())
const pending = new Set<string>()
let identity = '',
  scheduled = false
async function flush() {
  scheduled = false
  const key = identity,
    batch = [...pending].slice(0, 100)
  batch.forEach((id) => pending.delete(id))
  try {
    const result = await apiClient.post<Record<string, string>>(
      '/scdp/audit-actors/resolve',
      batch,
      { stayOnUnauthorized: true },
    )
    if (key === identity) for (const id of batch) names.set(id, result[id] || '姓名未记录')
  } catch {
    if (key === identity) for (const id of batch) names.set(id, '姓名暂不可用')
  }
  if (pending.size && !scheduled) {
    scheduled = true
    queueMicrotask(() => void flush())
  }
}
export function auditActorLabel(value: string | null | undefined): string {
  const id = value?.trim()
  if (!id) return '未记录'
  if (systemActors.has(id.toUpperCase())) return '系统同步'
  if (/[\u3400-\u9fff]/u.test(id)) return id
  const current = getAuthorizationHeader() ?? ''
  if (current !== identity) {
    identity = current
    names.clear()
    pending.clear()
  }
  if (names.has(id)) return names.get(id)!
  if (!current) return '姓名暂不可用'
  names.set(id, '加载中')
  pending.add(id)
  if (!scheduled) {
    scheduled = true
    queueMicrotask(() => void flush())
  }
  return '加载中'
}
