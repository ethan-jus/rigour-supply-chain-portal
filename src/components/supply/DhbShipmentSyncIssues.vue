<template>
  <section class="shipment-issues" aria-label="待处理发货">
    <div class="shipment-issues__header">
      <strong>待处理发货</strong>
      <div>
        <el-button :disabled="!!retrying" :loading="loading" @click="load">刷新待处理项</el-button>
        <el-button @click="openCenter">查看全部待处理</el-button>
      </div>
    </div>
    <el-alert v-if="error" :title="error" type="warning" :closable="false" />
    <el-alert
      v-if="retryMessage"
      :title="retryMessage"
      :type="retrySucceeded ? 'success' : 'warning'"
      :closable="false"
    />
    <el-table
      v-loading="loading"
      :data="pagedItems"
      size="small"
      :empty-text="error ? '未能读取待处理发货' : '暂无待处理发货'"
    >
      <el-table-column prop="sourceId" label="发货单号" min-width="160" />
      <!-- @vue-generic {DhbSyncOpenIssueItem} -->
      <el-table-column label="待处理问题" min-width="300">
        <template #default="{ row }">{{ issueSummary(row) }}</template>
      </el-table-column>
      <!-- @vue-generic {DhbSyncOpenIssueItem} -->
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button
            v-if="row.requiredDataType && row.requiredSourceId"
            link
            type="primary"
            :disabled="!!retrying"
            @click="manualLink?.open(row)"
            >{{ linkLabel(row) }}</el-button
          >
          <el-button v-else link type="primary" @click="openCenter">核对资料</el-button>
          <el-button
            v-if="row.replaySupported && !row.manualResolutionRequired"
            link
            type="primary"
            :disabled="!!retrying || loading"
            :loading="retrying === row.sourceId"
            @click="retry(row)"
            >重试</el-button
          >
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="items.length > 20"
      v-model:current-page="page"
      :page-size="20"
      :total="items.length"
      layout="total, prev, pager, next"
      class="shipment-issues__pagination"
    />
    <DhbDependencyManualLink ref="manualLink" @saved="onManualSaved" />
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DhbDependencyManualLink from './DhbDependencyManualLink.vue'
import {
  getDhbOpenIssues,
  getDhbSyncTasks,
  replayDhbOrderObject,
  type DhbSyncOpenIssueItem,
} from '@/api/core/dhb-orchestration'
const props = defineProps<{ connectorId: string }>()
const emit = defineEmits<{ repaired: [] }>()
const router = useRouter()
const manualLink = ref<InstanceType<typeof DhbDependencyManualLink>>()
function onManualSaved() {
  retrySucceeded.value = true
  retryMessage.value = '关联已保存，可重试本发货单。'
  void load()
}
const items = ref<DhbSyncOpenIssueItem[]>([])
const page = ref(1)
const pagedItems = computed(() => items.value.slice((page.value - 1) * 20, page.value * 20))
const names: Record<string, string> = {
  SALES_ORDER: '销售单',
  CUSTOMER: '客户',
  WAREHOUSE: '仓库',
  PRODUCT_SPU: '商品',
  PRODUCT_SKU: '商品规格',
}
function linkLabel(item: DhbSyncOpenIssueItem) {
  return `关联${names[item.requiredDataType || ''] || '资料'}`
}
function issueSummary(item: DhbSyncOpenIssueItem) {
  if (item.requiredDataType && item.requiredSourceId) {
    const owner =
      item.requiredDataType !== 'SALES_ORDER' && item.relatedSalesOrderNo
        ? `（销售单 ${item.relatedSalesOrderNo}）`
        : ''
    return `${names[item.requiredDataType] || '资料'} ${item.requiredSourceId} 待关联${owner}`
  }
  if (item.errorCode?.includes('BUSINESS_TIME_MISSING')) return '未取得发货时间'
  if (item.errorCode === 'DHB_SHIPMENT_ORDER_NO_MISSING') return '发货单缺少销售单号'
  if (item.errorCode?.includes('IDENTITY_CONFLICT') || item.manualResolutionRequired)
    return '发货资料关联冲突'
  if (item.errorCode?.includes('WAREHOUSE') || item.errorMessage?.includes('缺少仓库映射'))
    return '发货仓库待关联'
  if (item.errorCode?.includes('ORDER_MAPPING') || item.errorCode?.includes('SOURCE_ORDER'))
    return `销售单${item.relatedSalesOrderNo ? ` ${item.relatedSalesOrderNo}` : ''}待关联`
  return '发货信息未同步完整'
}
const loading = ref(false),
  retrying = ref(''),
  error = ref(''),
  retryMessage = ref(''),
  retrySucceeded = ref(false)
let generation = 0
function openCenter() {
  void router.push('/supply-chain/integration')
}
async function load() {
  const version = ++generation
  loading.value = true
  error.value = ''
  try {
    const groups = await getDhbOpenIssues(500)
    const sourceItems = groups
      .flatMap((g) => g.items)
      .filter((item) => item.connectorId === props.connectorId)
    const salesIds = new Set(
      sourceItems
        .filter((item) => item.sourceObjectType === 'SALES_SHIPMENT')
        .map((item) => item.sourceId),
    )
    const unique = new Map<string, DhbSyncOpenIssueItem>()
    for (const item of sourceItems) {
      if (
        item.connectorId !== props.connectorId ||
        !(
          item.sourceObjectType === 'SALES_SHIPMENT' ||
          (item.sourceObjectType === 'ERP_STOCK_OUT' &&
            (salesIds.has(item.sourceId) || item.relatedSalesOrderNo))
        )
      )
        continue
      const previous = unique.get(item.sourceId)
      // 同一发货在销售与库存处理阶段可能各有历史问题，统一使用销售发货入口。
      if (
        !previous ||
        (item.sourceObjectType === 'SALES_SHIPMENT' &&
          previous.sourceObjectType !== 'SALES_SHIPMENT') ||
        (item.sourceObjectType === previous.sourceObjectType &&
          (item.updatedAt ?? '') > (previous.updatedAt ?? ''))
      )
        unique.set(item.sourceId, item)
    }
    if (version === generation) {
      items.value = [...unique.values()].sort((a, b) =>
        (b.updatedAt || '').localeCompare(a.updatedAt || ''),
      )
      page.value = Math.min(page.value, Math.max(1, Math.ceil(items.value.length / 20)))
    }
  } catch {
    if (version === generation) {
      items.value = []
      error.value = '待处理发货暂时无法读取，请刷新或到同步中心核对。'
    }
  } finally {
    if (version === generation) loading.value = false
  }
}
async function retry(item: DhbSyncOpenIssueItem) {
  if (retrying.value || loading.value || !item.replaySupported || item.manualResolutionRequired)
    return
  retrying.value = item.sourceId
  retryMessage.value = ''
  retrySucceeded.value = false
  try {
    const tasks = (await getDhbSyncTasks()).filter(
      (t) =>
        t.connectorId === props.connectorId &&
        t.objectType === 'ORDER' &&
        !['PAUSED', 'DISABLED', 'DELETED'].includes(t.status),
    )
    if (tasks.length !== 1) {
      retryMessage.value = '同步设置异常，请联系管理员。'
      return
    }
    const result = await replayDhbOrderObject(tasks[0]!.id, {
      sourceObjectType: item.sourceObjectType,
      sourceId: item.sourceId,
    })
    retrySucceeded.value = result.status === 'SUCCEEDED'
    retryMessage.value = retrySucceeded.value
      ? `发货单 ${item.sourceId} 已处理完成`
      : `发货单 ${item.sourceId} 未处理完成，请查看待处理问题。`
    emit('repaired')
    await load()
  } catch {
    retryMessage.value = '未取得处理结果，请刷新后核对。'
  } finally {
    retrying.value = ''
  }
}
onMounted(load)
watch(
  () => props.connectorId,
  () => {
    items.value = []
    void load()
  },
)
</script>
<style scoped>
.shipment-issues {
  margin-top: 20px;
}
.shipment-issues__pagination {
  margin-top: 12px;
  justify-content: flex-end;
}
.shipment-issues__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
</style>
