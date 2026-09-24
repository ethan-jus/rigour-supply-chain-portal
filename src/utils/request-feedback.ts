import { readonly, ref } from 'vue'
import { errorMessage } from '@/api/core/error'

interface RequestFailureNotice { id: number; message: string; requestId: string; count: number }
const notices = ref<RequestFailureNotice[]>([])
let nextId = 0
const published = new WeakSet<object>()
export const requestFailureNotices = readonly(notices)

export function dismissRequestFailure(id: number) {
  notices.value = notices.value.filter(notice => notice.id !== id)
}

/** 提示留在弹窗之上，直到用户关闭；不包含 URL、请求内容或异常堆栈。 */
export function publishRequestFailure(reason: unknown) {
  if (reason === 'cancel' || reason === 'close') return
  if (reason && typeof reason === 'object') {
    if (published.has(reason)) return
    published.add(reason)
  }
  const failure = reason && typeof reason === 'object'
    ? reason as { code?: string; requestId?: string } : {}
  if (['REQUEST_CANCELLED', 'ERR_CANCELED'].includes(failure.code || '')) return
  const message = errorMessage(reason, '页面操作发生异常，请重试；若仍失败，请联系管理员。')
  const existing = notices.value.find(notice => notice.message === message)
  if (existing) {
    if (!failure.requestId || existing.requestId !== failure.requestId) existing.count += 1
    existing.requestId = failure.requestId || existing.requestId
  } else {
    notices.value = [...notices.value.slice(-2), {
      id: ++nextId, message, requestId: failure.requestId || '', count: 1,
    }]
  }
}
