<template>
  <div class="dhb-sync-center supply-page supply-page--integration">
    <section class="sync-heading">
      <div>
        <span class="eyebrow">外部同步 · 订货宝</span>
        <h1>订货宝同步中心</h1>
        <p>订货宝只作为后台来源接入，数据经过映射、幂等和对账后写入我方业务表；ERP、CRM、Order 主流程不承载同步运维动作。</p>
      </div>
      <el-tag type="info" effect="plain">运维视图</el-tag>
    </section>

    <el-alert
      class="boundary-alert"
      type="info"
      :closable="false"
      show-icon
      title="主业务页面参考成熟后台的筛选、列表、详情和处理节奏，但只围绕我方业务流程组织；同步规则集中在本页。"
    />

    <section class="sync-operation">
      <div class="operation-copy">
        <span>统一入口</span>
        <h2>按依赖顺序同步 ERP、CRM、Order 和字典</h2>
        <p>前端只提供统一手动同步；单模块同步只作为排障修复能力保留在后端，不放成业务员的默认操作。</p>
        <el-alert
          v-if="syncBusyMessage"
          class="sync-busy-alert"
          type="warning"
          show-icon
          :closable="false"
          :title="syncBusyMessage"
        />
      </div>
      <div class="operation-actions">
        <el-input-number
          v-model="maxPages"
          :min="1"
          :max="500"
          :step="10"
          controls-position="right"
          aria-label="最大页数"
        />
        <el-button type="primary" :loading="syncing" @click="runUnifiedSync">统一同步</el-button>
      </div>
    </section>

    <section v-if="latestResult" class="sync-result">
      <div class="result-summary">
        <div>
          <span>最近批次</span>
          <strong>{{ latestResult.batchId }}</strong>
        </div>
        <div>
          <span>执行状态</span>
          <el-tag :type="statusTag(latestResult.status)" effect="light">{{ statusLabel(latestResult.status) }}</el-tag>
        </div>
        <div>
          <span>耗时</span>
          <strong>{{ latestResult.elapsedSeconds.toFixed(1) }} 秒</strong>
        </div>
      </div>
      <el-table :data="latestSteps" border class="result-table" max-height="360">
        <el-table-column prop="domain" label="模块" width="90" fixed />
        <el-table-column prop="objectType" label="同步对象" min-width="170" />
        <el-table-column label="状态" width="110">
          <template #default="scope">
            <el-tag :type="statusTag(scope.row.status)" effect="light">{{ statusLabel(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fetched" label="来源数" width="110" align="right" />
        <el-table-column prop="changed" label="写入/变更" width="120" align="right" />
        <el-table-column prop="unmapped" label="未映射" width="110" align="right" />
        <el-table-column prop="message" label="说明" min-width="180" show-overflow-tooltip />
      </el-table>
    </section>

    <section class="sync-layout">
      <main class="sync-main">
        <el-tabs v-model="activeSection" class="sync-tabs">
          <el-tab-pane
            v-for="section in sections"
            :key="section.key"
            :label="section.title"
            :name="section.key"
          >
            <div class="section-panel">
              <div class="section-summary">
                <span>{{ section.domain }}</span>
                <h2>{{ section.title }}</h2>
                <p>{{ section.description }}</p>
              </div>
              <div class="rule-list">
                <article v-for="item in section.rules" :key="item.title" class="rule-item">
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.description }}</p>
                </article>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </main>

      <aside class="sync-boundary">
        <h2>落库边界</h2>
        <dl>
          <div v-for="item in boundaryRules" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { syncDhbOrchestration, type DhbSyncOrchestrationResult, type DhbSyncOrchestrationStatus } from '@/api'

interface SyncRule {
  title: string
  description: string
}

interface SyncSection {
  key: string
  title: string
  domain: string
  description: string
  rules: SyncRule[]
}

const activeSection = ref('overview')
const maxPages = ref(100)
const syncing = ref(false)
const syncBusyMessage = ref('')
const latestResult = ref<DhbSyncOrchestrationResult | null>(null)

const sections: SyncSection[] = [
  {
    key: 'overview',
    title: '同步概览',
    domain: '接入状态',
    description: '只看订货宝接入链路是否健康，不把这些指标散到 ERP、CRM、Order 业务页。',
    rules: [
      { title: '对象覆盖', description: '商品、客户、销售订单、库存和采购对象分别记录来源覆盖情况。' },
      { title: '最近运行', description: '展示最近一次全量、增量或修复任务的状态、耗时和结果摘要。' },
      { title: '写入目标', description: '有效数据最终落到我方新业务表，旧订货宝档案不再作为业务入口。' },
    ],
  },
  {
    key: 'mapping',
    title: '映射规则',
    domain: '字段与枚举',
    description: '订货宝字段、状态、字典和外部 ID 在后台映射到我方业务模型。',
    rules: [
      { title: '外部 ID 绑定', description: '用来源对象、来源 ID 和租户维度建立绑定，保证重复同步幂等。' },
      { title: '字段映射', description: '字段、枚举、状态统一映射到我方字段，不在业务页面暴露订货宝内部字段。' },
      { title: '冲突策略', description: '保护人工维护字段，同步只更新来源负责的字段集合。' },
    ],
  },
  {
    key: 'runs',
    title: '运行记录',
    domain: '批次审计',
    description: '按同步批次记录拉取、跳过、写入、失败和修复结果，支撑后续对账。',
    rules: [
      { title: 'payload hash 跳过', description: '来源 payload hash 未变化时直接跳过，避免重复写入业务表。' },
      { title: '模式区分', description: '全量、增量、修复任务分开记录，方便判断本次同步目的。' },
      { title: '结果证据', description: '保存来源数量、Raw 数量、目标表数量和失败数量，便于复盘。' },
    ],
  },
  {
    key: 'exceptions',
    title: '异常处理',
    domain: '失败闭环',
    description: '只处理同步链路异常，不在主业务流程里暴露第三方失败细节。',
    rules: [
      { title: '可重试失败', description: '网络、限流、临时服务错误进入重试队列。' },
      { title: '需人工确认', description: '字段缺失、字典未映射、外部 ID 冲突进入待处理池。' },
      { title: '修复入口', description: '修复任务以来源对象和失败原因重新执行，不要求业务人员进入旧档案页。' },
    ],
  },
  {
    key: 'assets',
    title: '图片附件',
    domain: 'COS 处理',
    rules: [
      { title: '对象已存在跳过', description: 'COS 中已有相同对象时不重复上传，直接复用已有 URL。' },
      { title: '稳定对象键', description: '对象路径由租户、来源对象和内容摘要生成，避免同一图片反复落不同地址。' },
      { title: '失败可修复', description: '上传失败记录在同步异常中，修复后再回填我方商品图片 URL。' },
    ],
  },
  {
    key: 'reconciliation',
    title: '对账校验',
    domain: '完整性',
    description: '同步完成后核对来源、Raw、绑定关系和目标业务表，缺失数据走修复任务。',
    rules: [
      { title: '数量对齐', description: '来源总数、Raw 落库数、目标业务表写入数分别记录。' },
      { title: '缺失识别', description: '发现来源存在但目标表缺失时生成修复建议。' },
      { title: '重复识别', description: '发现外部 ID 绑定重复或目标业务编码冲突时进入异常处理。' },
    ],
  },
]

const activeSectionDetail = computed(() =>
  sections.find((section) => section.key === activeSection.value) || sections[0],
)

const boundaryRules = [
  { label: '来源系统', value: '订货宝 API 与回执数据' },
  { label: '同步落点', value: 'Raw、外部 ID 绑定、运行审计、我方业务表' },
  { label: '业务入口', value: 'ERP、CRM、Order 只展示我方业务表结果' },
  { label: '页面动作', value: '默认只提供统一同步；单对象修复放在运维排障链路中逐步补齐' },
]

const latestSteps = computed(() =>
  latestResult.value?.tenants.flatMap((tenant) => tenant.steps) || [],
)

async function runUnifiedSync() {
  syncing.value = true
  syncBusyMessage.value = ''
  try {
    const result = await syncDhbOrchestration({ maxPages: maxPages.value })
    latestResult.value = result
    if (result.status === 'SUCCEEDED') {
      ElMessage.success('订货宝统一同步已完成')
    } else {
      ElMessage.warning('订货宝统一同步未全部成功，请查看结果明细')
    }
  } catch (reason) {
    if (isSyncBusyError(reason)) {
      syncBusyMessage.value = '后台已有订货宝同步任务正在执行，本次未重复发起；请稍后刷新页面或再次点击统一同步查看结果。'
      ElMessage.warning(syncBusyMessage.value)
      return
    }
    ElMessage.error(errorMessage(reason, '订货宝统一同步失败'))
  } finally {
    syncing.value = false
  }
}

function isSyncBusyError(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false
  const candidate = reason as { code?: unknown; response?: { status?: unknown } }
  return candidate.code === 'SERVICE_UNAVAILABLE' || candidate.response?.status === 503
}

function statusLabel(status: DhbSyncOrchestrationStatus | string) {
  const labels: Record<string, string> = {
    PENDING: '待执行',
    RUNNING: '执行中',
    SUCCEEDED: '成功',
    FAILED: '失败',
    SKIPPED: '已跳过',
  }
  return labels[status] || status || '-'
}

function statusTag(status: DhbSyncOrchestrationStatus | string): 'success' | 'info' | 'warning' | 'danger' {
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'RUNNING') return 'warning'
  return 'info'
}

function errorMessage(reason: unknown, fallback: string): string {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    const message = (reason as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (reason instanceof Error && reason.message) return reason.message
  return fallback
}

defineExpose({ activeSectionDetail, sections, boundaryRules, latestSteps, runUnifiedSync })
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.dhb-sync-center {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
}

.sync-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 20px 22px;
  border: 1px solid var(--supply-border);
  border-radius: var(--supply-radius);
  background: var(--supply-surface);
}

.sync-heading h1 {
  margin: 6px 0;
  color: var(--supply-text);
  font-size: 22px;
  font-weight: 700;
  line-height: 30px;
}

.sync-heading p {
  max-width: 900px;
  margin: 0;
  color: var(--supply-text-muted);
  font-size: $font-size-sm;
  line-height: 1.55;
}

.boundary-alert {
  flex: 0 0 auto;
}

.sync-operation,
.sync-result {
  border: 1px solid var(--supply-border);
  border-radius: var(--supply-radius);
  background: var(--supply-surface);
}

.sync-operation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 18px;
}

.sync-busy-alert {
  margin-top: 14px;
}

.operation-copy {
  min-width: 0;
}

.operation-copy span,
.result-summary span {
  color: var(--supply-primary);
  font-size: $font-size-xs;
  font-weight: 700;
}

.operation-copy h2 {
  margin: 6px 0;
  color: var(--supply-text);
  font-size: $font-size-lg;
  font-weight: 700;
}

.operation-copy p {
  margin: 0;
  color: var(--supply-text-muted);
  font-size: $font-size-sm;
  line-height: 1.55;
}

.operation-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.sync-result {
  padding: 14px 16px 16px;
}

.result-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px 150px;
  gap: 12px;
  margin-bottom: 12px;
}

.result-summary div {
  min-width: 0;
}

.result-summary strong {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: var(--supply-text);
  font-size: $font-size-sm;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-table {
  width: 100%;
}

.sync-layout {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
}

.sync-main,
.sync-boundary {
  min-width: 0;
  border: 1px solid var(--supply-border);
  border-radius: var(--supply-radius);
  background: var(--supply-surface);
}

.sync-main {
  padding: 14px 16px 18px;
}

.section-panel {
  display: grid;
  grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
  gap: 18px;
  padding-top: 10px;
}

.section-summary {
  padding: 14px;
  border: 1px solid var(--supply-border);
  border-radius: var(--supply-radius);
  background: var(--supply-surface-subtle);
}

.section-summary span {
  color: var(--supply-primary);
  font-size: $font-size-xs;
  font-weight: 700;
}

.section-summary h2,
.sync-boundary h2 {
  margin: 8px 0;
  color: var(--supply-text);
  font-size: $font-size-lg;
  font-weight: 700;
}

.section-summary p,
.rule-item p,
.sync-boundary dd {
  margin: 0;
  color: var(--supply-text-muted);
  font-size: $font-size-sm;
  line-height: 1.55;
}

.rule-list {
  display: grid;
  gap: 10px;
}

.rule-item {
  min-width: 0;
  padding: 13px 14px;
  border: 1px solid var(--supply-border);
  border-radius: var(--supply-radius);
  background: #fff;
}

.rule-item strong {
  display: block;
  margin-bottom: 5px;
  color: var(--supply-text);
  font-size: $font-size-sm;
}

.sync-boundary {
  padding: 16px;
}

.sync-boundary dl {
  display: grid;
  gap: 12px;
  margin: 0;
}

.sync-boundary div {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--supply-border);
}

.sync-boundary div:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.sync-boundary dt {
  margin-bottom: 5px;
  color: var(--supply-text);
  font-size: $font-size-xs;
  font-weight: 700;
}

@media (max-width: 1100px) {
  .sync-layout,
  .section-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .sync-heading,
  .sync-operation {
    flex-direction: column;
  }

  .operation-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .result-summary {
    grid-template-columns: 1fr;
  }
}
</style>
