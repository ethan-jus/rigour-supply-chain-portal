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
      :data="items"
      size="small"
      empty-text="暂无可显示的待处理发货；如本次仍提示未完成，请查看全部待处理。"
    >
      <el-table-column prop="sourceId" label="发货单号" min-width="160" />
      <el-table-column prop="errorMessage" label="未完成原因" min-width="300" />
      <!-- @vue-generic {DhbSyncOpenIssueItem} -->
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button
            v-if="row.requiredDataType && row.requiredSourceId"
            link
            type="primary"
            :disabled="!!retrying"
            @click="manualLink?.open(row)"
            >关联补录资料</el-button
          >
          <el-button v-else link type="primary" @click="openCenter">核对资料</el-button>
          <el-button
            v-if="row.replaySupported && !row.manualResolutionRequired"
            link
            type="primary"
            :disabled="!!retrying || loading"
            :loading="retrying === row.sourceId"
            @click="retry(row)"
            >继续关联</el-button
          >
        </template>
      </el-table-column>
    </el-table>
    <DhbDependencyManualLink ref="manualLink" @saved="onManualSaved" />
    <p>
      物流已保存即代表已经出库发货。补取失败的资料请先手工补录并关联，再点击“继续关联”。此处显示当前来源最近的待处理发货，最多
      500 项。
    </p>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
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
  retryMessage.value = '资料关联已保存，请点击本发货单的“继续关联”，复用已有运输记录。'
  void load()
}
const items = ref<DhbSyncOpenIssueItem[]>([])
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
    const unique = new Map<string, DhbSyncOpenIssueItem>()
    for (const item of groups.flatMap((g) => g.items)) {
      if (
        item.connectorId !== props.connectorId ||
        !['SALES_SHIPMENT', 'ERP_STOCK_OUT'].includes(item.sourceObjectType)
      )
        continue
      const key = `${item.sourceObjectType}:${item.sourceId}`
      const previous = unique.get(key)
      if (!previous || (item.updatedAt ?? '') > (previous.updatedAt ?? '')) unique.set(key, item)
    }
    if (version === generation) items.value = [...unique.values()]
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
        !['DISABLED', 'DELETED'].includes(t.status),
    )
    if (tasks.length !== 1) throw new Error('未找到唯一可用的订单同步任务，请管理员核对同步设置。')
    const result = await replayDhbOrderObject(tasks[0]!.id, {
      sourceObjectType: item.sourceObjectType,
      sourceId: item.sourceId,
    })
    retrySucceeded.value = result.status === 'SUCCEEDED'
    retryMessage.value = retrySucceeded.value
      ? `发货单 ${item.sourceId} 已处理完成`
      : result.errorMessage || `发货单 ${item.sourceId} 尚未完成，请核对原因后重试`
    emit('repaired')
    await load()
  } catch (cause) {
    retryMessage.value =
      cause instanceof Error ? cause.message : '未取得本单处理结果，请先刷新核对，不要重复提交。'
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
.shipment-issues__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
p {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.7;
}
</style>
