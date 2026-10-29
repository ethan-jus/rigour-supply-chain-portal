import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/assets/styles/index.scss'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import CrmStorePoolView from '@/views/supply-chain/crm/CrmStorePoolView.vue'
import { crmStoreApi, type StoreRow } from '@/api/core/crm-store'
import { apiClient } from '@/api/core/client'
import { sampleStores, storeContext } from '../../../tests/fixtures/crm-stores'

if (!import.meta.env.DEV) throw new Error('This fixture is for development QA only.')
const markerPreview = new URLSearchParams(location.search).get('scenario') === 'markers'
const rows: StoreRow[] = markerPreview
  ? sampleStores.map((row, index) => ({
      ...row,
      name: ['公海 · 未合作（演示）', '私海 · 未合作（演示）', '公海 · 已合作（演示）', '私海 · 已合作（演示）'][index]!,
      poolType: index % 2 ? 'PRIVATE' : 'PUBLIC',
      cooperationStatus: index < 2 ? 'NEVER' : 'COOPERATED',
      customerTier: index < 2 ? 'UNRATED' : 'A',
      tierUnratedReason: index < 2 ? 'NO_COOPERATION' : null,
      longitude: index % 2 ? 120.16 : 120.15,
      latitude: index < 2 ? 30.30 : 30.294,
      lastOrderAt: index < 2 ? null : row.lastOrderAt,
    }))
  : sampleStores
// The fixture page is independent of the app router. All requests are blocked locally.
for (const key of ['get', 'post', 'put', 'patch', 'delete'] as const) {
  if (key in apiClient) Object.assign(apiClient, { [key]: async (url: string) => {
    if (key === 'get' && url.includes('CRM_STORE_TYPE')) return { items: [] }
    throw new Error('界面验收模式：未连接业务接口，不保存修改。')
  } })
}
crmStoreApi.context = async () => ({ ...structuredClone(storeContext), permissions: [...storeContext.permissions, ...(markerPreview ? ['crm:store:manage'] : [])] })
crmStoreApi.list = async (query) => {
  const items = rows.filter((row) => (!query.keyword || `${row.name}${row.address}`.includes(query.keyword)) && (!query.cooperation || row.cooperationStatus === query.cooperation))
  return { items: structuredClone(items), total: items.length, nextCursor: null }
}
crmStoreApi.detail = async (id) => structuredClone(rows.find((row) => row.id === id)!)
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: CrmStorePoolView }] })
await router.push(`/supply-chain/crm/stores/${markerPreview ? 'library' : 'public'}`)
await router.isReady()
createApp(CrmStorePoolView).use(router).use(ElementPlus, { locale: zhCn }).mount('#app')
