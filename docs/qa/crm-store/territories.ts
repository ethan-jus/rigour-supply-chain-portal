import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/assets/styles/index.scss'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import StoreTerritoryView from '@/views/supply-chain/settings/StoreTerritoryView.vue'
import { storeTerritoryApi } from '@/api/core/store-territories'
import { apiClient } from '@/api'
import { territoryContext } from '../../../tests/fixtures/store-territories'

if (!import.meta.env.DEV) throw new Error('Development QA fixture only')
for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
  if (method in apiClient) Object.assign(apiClient, { [method]: async () => { throw new Error('隔离验收：业务请求已阻止') } })
}
const data = structuredClone(territoryContext)
storeTerritoryApi.context = async () => structuredClone(data)
storeTerritoryApi.save = async (department, command) => {
  if (command.applicationVersion !== data.applicationVersion) throw new Error('权限配置已变化，请刷新')
  const row = data.departments.find(d => d.id === department)!
  row.areas = command.areaCodes.map(code => ({ version: data.catalog.version, code }))
  data.applicationVersion++
}
createApp(StoreTerritoryView).use(ElementPlus, { locale: zhCn }).mount('#app')
