<template>
  <div class="master-data-sync-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <span>ERP · 商品中心</span>
            <h1>数据同步</h1>
            <p>按主数据类型触发订货宝同步，结果由 ERP 批次化处理并幂等落库。</p>
          </div>
        </div>
      </template>

      <el-alert
        class="boundary-alert"
        type="info"
        :closable="false"
        show-icon
        title="Portal 只调用 ERP 同步接口；ERP 负责调用 Integration、批次记录、幂等落库和内部状态保护。"
      />

      <el-form class="sync-form" inline @submit.prevent="synchronize">
        <el-form-item label="同步对象">
          <el-select v-model="objectType" style="width: 220px">
            <el-option
              v-for="item in syncOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="最大页数">
          <el-input-number v-model="maxPages" :min="1" :max="100" />
        </el-form-item>
        <el-form-item>
          <el-button
            v-if="canSync"
            type="primary"
            :loading="syncing"
            @click="synchronize"
          >
            开始同步
          </el-button>
          <el-tag v-else type="warning" effect="plain">无同步权限</el-tag>
        </el-form-item>
      </el-form>

      <el-divider content-position="left">一期接口能力</el-divider>
      <div class="capability-list">
        <el-tag v-for="item in syncOptions" :key="item.value" effect="plain">{{ item.label }}</el-tag>
      </div>
      <p class="capability-note">
        当前 ERP V1 已提供按类型同步接口和本次同步结果；同步批次历史、失败记录、来源绑定和重试页面待 ERP 提供对应查询接口后接入。
      </p>

      <el-card v-if="result" class="result-card" shadow="never">
        <template #header>
          <div class="result-header">
            <span>最近一次同步结果</span>
            <el-tag :type="result.status === 'SUCCEEDED' ? 'success' : 'warning'" effect="plain">
              {{ formatPortalStatus(result.status) }}
            </el-tag>
          </div>
        </template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="同步对象">{{ objectLabel(result.objectType) }}</el-descriptions-item>
          <el-descriptions-item label="同步批次">{{ result.runId }}</el-descriptions-item>
          <el-descriptions-item label="完成时间">{{ formatTime(result.completedAt) }}</el-descriptions-item>
          <el-descriptions-item label="获取数量">{{ result.fetched }}</el-descriptions-item>
          <el-descriptions-item label="新增数量">{{ result.created }}</el-descriptions-item>
          <el-descriptions-item label="变更数量">{{ result.changed }}</el-descriptions-item>
          <el-descriptions-item label="重复跳过">{{ result.duplicates }}</el-descriptions-item>
          <el-descriptions-item label="拒绝数量">{{ result.rejected }}</el-descriptions-item>
          <el-descriptions-item label="字典未解析">{{ result.unmapped }}</el-descriptions-item>
          <el-descriptions-item label="读取页数">{{ result.pages }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  syncErpData,
  type ErpDataSyncResult,
  type ErpMasterDataObjectType,
} from '@/api'
import { useAuthStore } from '@/stores/auth'
import { formatPortalStatus } from '@/utils/portal-labels'

const syncOptions: Array<{ value: ErpMasterDataObjectType; label: string }> = [
  { value: 'PRODUCT_SPU', label: '商品/SPU（包含 SKU）' },
  { value: 'CATEGORY', label: '商品分类' },
  { value: 'BRAND', label: '商品品牌' },
  { value: 'SPECIFICATION', label: '商品规格及规格值' },
  { value: 'TAG', label: '商品标签' },
]

const auth = useAuthStore()
const canSync = computed(() => auth.hasPermission('erp:product:write'))
const objectType = ref<ErpMasterDataObjectType>('PRODUCT_SPU')
const maxPages = ref(100)
const syncing = ref(false)
const result = ref<ErpDataSyncResult | null>(null)

async function synchronize() {
  if (!canSync.value) return
  syncing.value = true
  try {
    result.value = await syncErpData(objectType.value, maxPages.value)
    const warning = result.value.unmapped > 0 ? `，字典未解析${result.value.unmapped}项` : ''
    ElMessage.success(`${objectLabel(result.value.objectType)}同步完成${warning}`)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '商品主数据同步失败'))
  } finally {
    syncing.value = false
  }
}

function objectLabel(value: string) {
  return syncOptions.find((item) => item.value === value)?.label ?? `未知同步对象（${value}）`
}

function formatTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function errorMessage(reason: unknown, fallback: string) {
  if (typeof reason === 'object' && reason !== null && 'message' in reason) {
    const message = (reason as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}
</script>

<style scoped lang="scss">
.master-data-sync-page { padding-bottom: 20px; }

.page-header {
  span { color: #64748b; font-size: 13px; }
  h1 { margin: 5px 0; font-size: 22px; color: #0f172a; }
  p { margin: 0; color: #64748b; }
}

.boundary-alert { margin-bottom: 22px; }
.sync-form { margin-bottom: 8px; }
.capability-list { display: flex; flex-wrap: wrap; gap: 10px; }
.capability-note { color: #64748b; font-size: 13px; line-height: 1.7; }
.result-card { margin-top: 24px; }
.result-header { display: flex; align-items: center; justify-content: space-between; }

@media (max-width: 720px) {
  .sync-form :deep(.el-form-item) { width: 100%; margin-right: 0; }
  .sync-form :deep(.el-select), .sync-form :deep(.el-input-number) { width: 100% !important; }
}
</style>
