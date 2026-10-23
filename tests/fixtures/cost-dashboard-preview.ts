// 仅由测试 HTML 引用，不进入 Portal 正式入口。合成数据来自后端六类成本契约测试。
import { createApp } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { apiClient } from '@/api/core/client'
import CostDashboardView from '@/views/supply-chain/bi/CostDashboardView.vue'
import responses from './cost-dashboard-six-costs.json'
import type { CostQuery } from '@/api/core/bi-cost-dashboard'
const contracts = responses as Record<string, { report: unknown; records: unknown }>
apiClient.get = (async (url: string, options?: { params?: CostQuery }) => {
  if (url.includes('business-settings')) return { items: [] }
  const q = options?.params ?? {}
  if (
    (q.year && q.year !== 2026) ||
    (q.month != null && q.month !== 9) ||
    q.city ||
    q.dimensionKey ||
    q.search ||
    (q.page && q.page !== 1) ||
    (q.size && q.size !== 20) ||
    (q.status && q.status !== 'CONFIRMED') ||
    (q.payment && q.payment !== 'ALL') ||
    (q.periodSide && q.periodSide !== 'current') ||
    (q.compare && q.compare !== 'previous') ||
    q.missingAmount
  )
    throw new Error('此隔离夹具仅提供2026年9月全部城市的首屏分类数据；完整筛选须在真实账号环境验收')
  const prefix = `${q.scope ?? 'opex'}:${q.category ?? '_'}:`
  const key = q.dimension
    ? prefix + q.dimension
    : Object.keys(contracts).find((key) => key.startsWith(prefix))
  const contract = key ? contracts[key] : undefined
  if (!contract) throw new Error('该测试场景没有预生成的后端响应')
  if (url.endsWith('/overview')) return structuredClone(contract.report)
  if (url.endsWith('/records')) return structuredClone(contract.records)
  throw new Error('视觉夹具未模拟此操作；请使用正式环境验收')
}) as typeof apiClient.get
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: CostDashboardView }],
})
createApp(CostDashboardView).use(router).mount('#app')
// 夹具只允许固定读取，所有写操作都在本地拒绝，避免误连实际环境。
const rejectFixtureWrite = async () => {
  throw new Error('视觉验证页不执行写入和导出，请在授权验收环境操作')
}
apiClient.post = rejectFixtureWrite as typeof apiClient.post
apiClient.put = rejectFixtureWrite as typeof apiClient.put
apiClient.delete = rejectFixtureWrite as typeof apiClient.delete
