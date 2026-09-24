import { computed, onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'
import {
  getSupplyDashboardOverview,
  getSupplyDashboardOperatingAnalysis,
  type SupplyDashboardOverview,
  type SupplyDashboardOperatingAnalysis,
} from '@/api/core/bi'
import { getBiEffectiveScope } from '@/api/core/bi-access'
import { getOrderRegisterOrders, getOrderRegisterPayments } from '@/api/core/order-register'
import { businessDate, businessDateRange } from '@/utils/business-date'
import type { ConsoleEntry } from '@/utils/console-navigation'
import { useAuthStore } from '@/stores/auth'

export type HomeTask = 'shipment' | 'payment' | 'unpaid'
export interface HomeTaskRow {
  id: string
  orderNo: string
  customer: string
  date: string | null
  amount: number | null
}
export interface HomeTaskState {
  count: number | null
  rows: HomeTaskRow[]
  loading: boolean
  error: string
}
export const homeTaskLabels: Record<HomeTask, string> = {
  shipment: '待发货',
  payment: '待核回款',
  unpaid: '待回款',
}
export const homeTaskQueries = {
  shipment: { orderStatusCode: 'PENDING_SHIPPED' },
  payment: { paymentStatusCode: 'RECEIVED' },
  unpaid: { hasUnpaid: true },
} as const

export function useConsoleHomeData(entries: Ref<ConsoleEntry[]>) {
  const auth = useAuthStore()
  const today = ref(businessDate(new Date()))
  const query = computed(() => businessDateRange(`${today.value.slice(0, 7)}-01`, today.value))
  const overview = ref<SupplyDashboardOverview | null>(null)
  const analysis = ref<SupplyDashboardOperatingAnalysis | null>(null)
  const summaryLoading = ref(false)
  const summaryError = ref('')
  const retentionError = ref('')
  const scopeLabel = ref('授权数据范围')
  const tasks = reactive<Record<HomeTask, HomeTaskState>>({
    shipment: { count: null, rows: [], loading: false, error: '' },
    payment: { count: null, rows: [], loading: false, error: '' },
    unpaid: { count: null, rows: [], loading: false, error: '' },
  })
  const has = (path: string) => entries.value.some((entry) => entry.path === path)
  const canReadSummary = computed(() => has('/supply-chain/bi'))
  const availableTasks = computed<HomeTask[]>(() => [
    ...(has('/supply-chain/order/sales-orders') ? ['shipment' as const] : []),
    ...(has('/supply-chain/order/sales-payments') ? ['payment' as const] : []),
    ...(has('/supply-chain/order/sales-orders') ? ['unpaid' as const] : []),
  ])
  let generation = 0
  async function loadSummary(version: number) {
    summaryLoading.value = true
    try {
      const scope = await getBiEffectiveScope()
      if (version !== generation) return
      if (scope.accessLevel === 'DENIED') throw new Error('DENIED')
      scopeLabel.value = scope.accessLevel === 'TENANT' ? '企业经营数据' : '授权数据范围'
      const [data, retention] = await Promise.allSettled([
        getSupplyDashboardOverview(query.value),
        getSupplyDashboardOperatingAnalysis(query.value),
      ])
      if (version !== generation) return
      if (data.status === 'rejected') throw data.reason
      overview.value = data.value
      if (retention.status === 'fulfilled') analysis.value = retention.value
      else retentionError.value = '复购数据暂不可用'
    } catch {
      if (version === generation) summaryError.value = '经营数据暂不可用，请重试或检查数据权限'
    } finally {
      if (version === generation) summaryLoading.value = false
    }
  }
  async function loadTask(key: HomeTask, version: number) {
    tasks[key].loading = true
    try {
      if (key === 'payment') {
        const page = await getOrderRegisterPayments({
          begin: 0,
          step: 5,
          ...homeTaskQueries.payment,
          sortBy: 'paymentTime',
          sortDirection: 'desc',
        })
        if (version !== generation) return
        tasks[key].count = page.total
        tasks[key].rows = page.items.map((row) => ({
          id: row.id,
          orderNo: row.orderNo,
          customer: row.customerName || '未命名客户',
          date: row.paymentTime,
          amount: row.paidAmount,
        }))
      } else {
        const page = await getOrderRegisterOrders({
          begin: 0,
          step: 5,
          ...homeTaskQueries[key],
          sortBy: 'orderDate',
          sortDirection: 'desc',
        })
        if (version !== generation) return
        tasks[key].count = page.total
        tasks[key].rows = page.items.map((row) => ({
          id: row.id,
          orderNo: row.orderNo,
          customer: row.customerName || '未命名客户',
          date: row.orderDate,
          amount: key === 'unpaid' ? row.unpaidAmount : row.payableAmount,
        }))
      }
    } catch {
      if (version === generation) tasks[key].error = '待办加载失败，请重试'
    } finally {
      if (version === generation) tasks[key].loading = false
    }
  }
  function refresh() {
    const version = ++generation
    today.value = businessDate(new Date())
    overview.value = null
    analysis.value = null
    summaryError.value = ''
    retentionError.value = ''
    summaryLoading.value = false
    for (const key of Object.keys(tasks) as HomeTask[])
      Object.assign(tasks[key], { count: null, rows: [], loading: false, error: '' })
    if (canReadSummary.value) void loadSummary(version)
    availableTasks.value.forEach((key) => {
      void loadTask(key, version)
    })
  }
  watch(
    () =>
      `${auth.user?.tenantId || ''}:${auth.user?.id || ''}:${canReadSummary.value}:${availableTasks.value.join(',')}`,
    refresh,
    { immediate: true },
  )
  onBeforeUnmount(() => {
    generation++
  })
  return {
    overview,
    analysis,
    query,
    today,
    summaryLoading,
    summaryError,
    retentionError,
    scopeLabel,
    tasks,
    canReadSummary,
    availableTasks,
    refresh,
  }
}
