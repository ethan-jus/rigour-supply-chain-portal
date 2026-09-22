import { computed, onBeforeUnmount, ref } from 'vue'
import { isAxiosError } from 'axios'
import { getDhbPageSyncJob, latestDhbPageSyncJob, startDhbPageSyncJob, type DhbPageSyncJob, type PageSyncCommand } from '@/api/core/dhb-page-sync'
import type { DhbSyncOrchestrationResult } from '@/api/core/dhb-orchestration'

/** 轮询断线只改变连接提示；不把未知结果当失败，也不自动再次提交。 */
export function useDhbSyncJob(completed: (result: DhbSyncOrchestrationResult) => void) {
  const job = ref<DhbPageSyncJob | null>(null)
  const submitting = ref(false)
  const tracking = ref(false)
  const notice = ref('')
  const error = ref('')
  const busy = computed(() => submitting.value || tracking.value)
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let emittedId: string | undefined
  let trackedId: string | undefined
  let requestedScope: PageSyncCommand['scope'] | undefined

  function schedule() {
    if (disposed || !tracking.value) return
    clearTimeout(timer)
    timer = setTimeout(() => { void poll() }, 2000)
  }
  function accept(value: DhbPageSyncJob) {
    job.value = value
    trackedId = value.jobId
    const otherScope = requestedScope && value.scope !== requestedScope
    notice.value = otherScope
      ? `当前连接正在处理${value.scope === 'CUSTOMER' ? '客户' : '订单'}同步，本次未另行启动任务。请等待结束后再开始所需同步。`
      : ''
    tracking.value = !['SUCCEEDED', 'FAILED'].includes(value.status)
    if (!tracking.value) {
      if (!otherScope && value.result && emittedId !== value.jobId) {
        emittedId = value.jobId
        completed(value.result)
      } else if (value.status === 'FAILED') error.value = value.stage
    }
    schedule()
  }
  async function poll() {
    if (disposed || !trackedId) return
    try {
      const value = await getDhbPageSyncJob(trackedId)
      if (!disposed) accept(value)
    } catch {
      if (disposed) return
      notice.value = '暂时无法获取进度，正在重新连接。后台任务可能仍在运行，请勿重复提交。'
      schedule()
    }
  }
  async function start(command: PageSyncCommand) {
    if (busy.value || disposed) return
    submitting.value = true
    requestedScope = command.scope
    error.value = ''
    notice.value = ''
    try {
      // 刷新页面或多窗口操作时先找已运行任务；无运行任务才提交新任务。
      const latest = await latestDhbPageSyncJob(command.connectorId, command.scope)
      if (disposed) return
      if (latest && !['SUCCEEDED', 'FAILED'].includes(latest.status)) {
        accept(latest)
        return
      }
      job.value = null
      trackedId = crypto.randomUUID()
      try {
        const value = await startDhbPageSyncJob(trackedId, command)
        if (!disposed) accept(value)
      } catch (cause) {
        if (disposed) return
        const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : ''
        if (['BAD_REQUEST', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR', 'SYNC_ALREADY_RUNNING', 'UNAUTHORIZED'].includes(code))
          throw cause
        if (isAxiosError(cause) && cause.response && cause.response.status < 500
            && ![408, 429].includes(cause.response.status)) throw cause
        // POST 响应丢失也可能已经提交成功。只用原编号查询，绝不重新 POST。
        tracking.value = true
        notice.value = '提交回执暂未收到，正在确认原任务状态；不会重复启动同步。'
        schedule()
      }
    } catch (cause) {
      error.value = typeof cause === 'object' && cause !== null && 'message' in cause
        ? String(cause.message) : '无法读取同步任务状态，请稍后重试'
    } finally { submitting.value = false }
  }
  onBeforeUnmount(() => { disposed = true; clearTimeout(timer) })
  return { job, busy, notice, error, start, refresh: poll }
}
