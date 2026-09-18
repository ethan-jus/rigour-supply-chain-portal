<template>
  <section class="audit-page" v-loading="loading">
    <SupplyPageTitle>操作日志</SupplyPageTitle>
    <el-tabs v-model="module" @tab-change="changeModule"
      ><el-tab-pane label="用户、角色与菜单" name="IAM" /><el-tab-pane
        label="数据字典"
        name="DICTIONARY" /><el-tab-pane label="业务参数" name="PARAMETER"
    /></el-tabs>
    <el-form inline @submit.prevent="search"
      ><el-form-item label="关键词"
        ><el-input v-model="keyword" clearable placeholder="操作用户或对象标识" /></el-form-item
      ><el-form-item label="操作"
        ><el-select v-model="action" clearable style="width: 170px"
          ><el-option
            v-for="(label, value) in actions"
            :key="value"
            :label="label"
            :value="value" /></el-select></el-form-item
      ><el-button type="primary" @click="search">查询</el-button></el-form
    >
    <el-table :data="result.items" border
      ><el-table-column prop="occurredAt" label="时间" min-width="190"
        ><template #default="{ row }">{{
          displayDateTime(row.occurredAt)
        }}</template></el-table-column
      ><el-table-column prop="actor" label="操作用户" width="130" /><el-table-column
        label="操作"
        width="150"
        ><template #default="{ row }">{{
          actions[row.action] || row.action
        }}</template></el-table-column
      ><el-table-column
        prop="summary"
        label="说明"
        min-width="260"
        show-overflow-tooltip
      /><el-table-column
        prop="targetId"
        label="对象标识"
        min-width="220"
        show-overflow-tooltip
      /><el-table-column label="结果" width="90"
        ><template #default="{ row }">{{
          row.result === 'SUCCESS' ? '成功' : '失败'
        }}</template></el-table-column
      ></el-table
    >
    <el-pagination
      v-model:current-page="page"
      :page-size="20"
      :total="result.total"
      layout="total, prev, pager, next"
      @current-change="load"
    />
  </section>
</template>
<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { onMounted, ref } from 'vue'
import { apiClient } from '@/api/core/client'
import { supplySettingsApi, type SettingsAuditPage } from '@/api/core/supply-settings'
const module = ref('IAM')
const loading = ref(false),
  keyword = ref(''),
  action = ref(''),
  page = ref(1)
const result = ref<SettingsAuditPage>({ items: [], total: 0, page: 1, pageSize: 20 })
const actions: Record<string, string> = {
  SETTINGS_INITIALIZE: '初始化设置',
  MENU_CREATE: '新增菜单',
  MENU_UPDATE: '编辑菜单',
  MENU_DELETE: '删除菜单',
  USER_CREATE: '新增用户',
  USER_UPDATE: '编辑用户',
  USER_DELETE: '删除用户',
  ROLE_CREATE: '新增角色',
  ROLE_UPDATE: '编辑角色',
  ROLE_DELETE: '删除角色',
  ROLE_ASSIGN: '分配角色',
  ROLE_BATCH: '批量设置角色',
  'dictionary:create': '新增字典',
  'dictionary:update': '编辑字典',
  'dictionary-item:create': '新增字典项',
  'dictionary-item:update': '编辑字典项',
  'dictionary-item:sync': '同步字典项',
  PARAMETER_UPDATE: '修改业务参数',
}
async function load() {
  loading.value = true
  try {
    const query = {
      action: action.value || undefined,
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize: 20,
    }
    result.value =
      module.value === 'IAM'
        ? await supplySettingsApi.audits(query)
        : await apiClient.get<SettingsAuditPage>(
            module.value === 'DICTIONARY'
              ? '/business-settings/operation-audits'
              : '/orders/settings/operation-audits',
            { params: query },
          )
  } finally {
    loading.value = false
  }
}
async function changeModule() {
  action.value = ''
  result.value = { items: [], total: 0, page: 1, pageSize: 20 }
  await search()
}
async function search() {
  page.value = 1
  await load()
}
onMounted(load)
</script>
<style scoped>
.audit-page {
  padding: 20px;
}
.el-pagination {
  margin-top: 20px;
  justify-content: flex-end;
}
</style>
