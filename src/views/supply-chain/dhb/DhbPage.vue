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
          :max="100"
          :step="10"
          controls-position="right"
          aria-label="最大页数"
        />
        <el-button type="primary" :loading="syncing && runningStage === 'full'" @click="runUnifiedSync">
          统一同步
        </el-button>
      </div>
    </section>

    <section class="stage-sync">
      <div class="stage-sync__heading">
        <span>分段执行</span>
        <strong>重同步验收按依赖顺序逐段推进</strong>
      </div>
      <div class="stage-sync__actions">
        <el-button
          v-for="stage in syncStages"
          :key="stage.key"
          :loading="syncing && runningStage === stage.key"
          :disabled="syncing && runningStage !== stage.key"
          @click="runStageSync(stage)"
        >
          {{ stage.label }}
        </el-button>
      </div>
    </section>

    <section class="issue-workbench">
      <div class="issue-workbench__heading">
        <div>
          <span>待处理闭环</span>
          <h2>OPEN 异常按统一规则处理</h2>
          <p>后端负责归因和动作分类；页面只展示可处理入口，不按错误码自行猜业务含义。</p>
        </div>
        <el-button :icon="Refresh" :loading="issueLoading" @click="loadIssueWorkbench">
          刷新
        </el-button>
      </div>

      <div class="issue-metrics">
        <div>
          <span>分组</span>
          <strong>{{ issueGroups.length }}</strong>
        </div>
        <div>
          <span>来源对象</span>
          <strong>{{ issueSummary.uniqueSources }}</strong>
        </div>
        <div>
          <span>需裁决</span>
          <strong>{{ issueSummary.manualSources }}</strong>
        </div>
        <div>
          <span>可重放</span>
          <strong>{{ issueSummary.replaySources }}</strong>
        </div>
      </div>

      <div v-if="issueGroups.length" class="issue-group-list" aria-label="待处理问题分组">
        <button
          type="button"
          :class="['issue-group', { 'issue-group--active': activeIssueGroupKey === ALL_ISSUE_GROUPS }]"
          @click="activeIssueGroupKey = ALL_ISSUE_GROUPS"
        >
          <span>全部</span>
          <strong>{{ issueSummary.uniqueSources }}</strong>
        </button>
        <button
          v-for="group in issueGroups"
          :key="issueGroupKey(group)"
          type="button"
          :class="['issue-group', { 'issue-group--active': activeIssueGroupKey === issueGroupKey(group) }]"
          @click="activeIssueGroupKey = issueGroupKey(group)"
        >
          <span>{{ group.title }}</span>
          <strong>{{ group.uniqueSourceCount }}</strong>
          <small>{{ actionLabel(group.actionType) }}</small>
        </button>
      </div>

      <el-empty
        v-if="!issueLoading && !visibleIssueItems.length"
        description="当前没有待处理的订货宝同步异常"
      />
      <el-table
        v-else
        v-loading="issueLoading"
        :data="visibleIssueItems"
        border
        class="issue-table"
        max-height="420"
      >
        <el-table-column prop="sourceObjectType" label="来源对象" width="140" />
        <el-table-column prop="sourceId" label="来源单号" min-width="160" show-overflow-tooltip />
        <el-table-column label="处理类型" width="140">
          <template #default="scope">
            <el-tag effect="plain">{{ actionLabel(scope.row.actionType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="errorCode" label="错误码" min-width="220" show-overflow-tooltip />
        <el-table-column label="候选入库单" min-width="220">
          <template #default="scope">
            <div v-if="scope.row.candidateSourceIds.length" class="candidate-list">
              <el-tag
                v-for="candidate in scope.row.candidateSourceIds"
                :key="candidate"
                effect="light"
              >
                {{ candidate }}
              </el-tag>
            </div>
            <span v-else class="muted-text">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="handlingAdvice" label="建议处理" min-width="260" show-overflow-tooltip />
        <el-table-column label="更新时间" width="170">
          <template #default="scope">
            {{ formatTime(scope.row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <div class="issue-actions">
              <el-button
                v-if="scope.row.manualResolutionRequired"
                size="small"
                type="primary"
                :icon="Check"
                @click="openResolution(scope.row)"
              >
                裁决
              </el-button>
              <el-button
                v-if="scope.row.replaySupported"
                size="small"
                :icon="Refresh"
                :loading="replayingSourceId === scope.row.sourceId"
                @click="replayIssue(scope.row)"
              >
                重放
              </el-button>
              <span v-if="!scope.row.manualResolutionRequired && !scope.row.replaySupported" class="issue-action-hint">
                按建议处理
              </span>
            </div>
          </template>
        </el-table-column>
      </el-table>
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
          <strong>{{ syncDurationLabel }}</strong>
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

    <el-dialog
      v-model="resolutionDialogVisible"
      title="调拨入库人工裁决"
      width="680px"
      append-to-body
    >
      <div v-if="selectedIssue" class="resolution-dialog">
        <dl class="resolution-summary">
          <div>
            <dt>来源出库单</dt>
            <dd>{{ selectedIssue.sourceId }}</dd>
          </div>
          <div>
            <dt>错误码</dt>
            <dd>{{ selectedIssue.errorCode || '-' }}</dd>
          </div>
        </dl>

        <label class="resolution-label" for="dhb-resolution-receipt">选择正确入库单</label>
        <el-select
          id="dhb-resolution-receipt"
          v-model="selectedReceiptId"
          filterable
          class="resolution-select"
          placeholder="选择订货宝入库单"
        >
          <el-option
            v-for="candidate in selectedIssue.candidateSourceIds"
            :key="candidate"
            :label="candidate"
            :value="candidate"
          />
        </el-select>

        <div v-if="candidateReceiptRows.length" class="candidate-detail-list">
          <div v-for="receipt in candidateReceiptRows" :key="receipt.sourceId || receipt.number">
            <strong>{{ receipt.number || receipt.sourceId }}</strong>
            <span>{{ receipt.warehouseName || '-' }} · {{ formatTime(receipt.storageAt) }}</span>
          </div>
        </div>

        <label class="resolution-label" for="dhb-resolution-reason">裁决原因</label>
        <el-input
          id="dhb-resolution-reason"
          v-model="resolutionReason"
          type="textarea"
          :rows="3"
          placeholder="例如：核对调拨明细、仓库和入库时间后确认"
        />
      </div>
      <template #footer>
        <el-button @click="resolutionDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resolutionSubmitting" @click="submitManualResolution">
          保存裁决并重放
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Refresh } from '@element-plus/icons-vue'
import {
  createDhbManualResolution,
  getDhbOpenIssues,
  getDhbSyncTasks,
  queryDhbWarehousingReceipts,
  replayDhbOrderObject,
  syncDhbOrchestration,
  type DhbSyncOpenIssueGroup,
  type DhbSyncOpenIssueItem,
  type DhbSyncOrchestrationCommand,
  type DhbSyncOrchestrationResult,
  type DhbSyncOrchestrationStatus,
  type DhbSyncTask,
  type DhbWarehousingReceipt,
} from '@/api'

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

interface SyncStage {
  key: string
  label: string
  command: Omit<DhbSyncOrchestrationCommand, 'maxPages'>
}

const activeSection = ref('overview')
const maxPages = ref(100)
const syncing = ref(false)
const runningStage = ref('')
const syncBusyMessage = ref('')
const latestResult = ref<DhbSyncOrchestrationResult | null>(null)
const issueLoading = ref(false)
const issueGroups = ref<DhbSyncOpenIssueGroup[]>([])
const syncTasks = ref<DhbSyncTask[]>([])
const activeIssueGroupKey = ref('__all__')
const resolutionDialogVisible = ref(false)
const resolutionSubmitting = ref(false)
const replayingSourceId = ref('')
const selectedIssue = ref<IssueItemWithAction | null>(null)
const selectedReceiptId = ref('')
const resolutionReason = ref('')
const receiptDetails = ref<Record<string, DhbWarehousingReceipt>>({})

const ALL_ISSUE_GROUPS = '__all__'

type IssueItemWithAction = DhbSyncOpenIssueItem & {
  groupTitle: string
  actionType: string
}

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

const syncStages: SyncStage[] = [
  {
    key: 'dictionary-iam',
    label: '1 字典/IAM',
    command: {
      includeDictionary: true,
      includeIam: true,
      includeErp: false,
      includeCrm: false,
      includeOrder: false,
    },
  },
  {
    key: 'erp-product',
    label: '2 ERP商品',
    command: {
      includeDictionary: false,
      includeIam: false,
      includeErp: true,
      includeErpProduct: true,
      includeErpSupply: false,
      includeCrm: false,
      includeOrder: false,
    },
  },
  {
    key: 'crm',
    label: '3 CRM客户',
    command: {
      includeDictionary: false,
      includeIam: false,
      includeErp: false,
      includeCrm: true,
      includeOrder: false,
    },
  },
  {
    key: 'erp-supply',
    label: '4 ERP供应链',
    command: {
      includeDictionary: false,
      includeIam: false,
      includeErp: true,
      includeErpProduct: false,
      includeErpSupply: true,
      includeCrm: false,
      includeOrder: false,
    },
  },
  {
    key: 'order',
    label: '5 Order订单',
    command: {
      includeDictionary: false,
      includeIam: false,
      includeErp: false,
      includeCrm: false,
      includeOrder: true,
    },
  },
]

const latestSteps = computed(() =>
  latestResult.value?.tenants.flatMap((tenant) => tenant.steps) || [],
)

const visibleIssueItems = computed<IssueItemWithAction[]>(() => {
  const selectedKey = activeIssueGroupKey.value
  return issueGroups.value
    .filter((group) => selectedKey === ALL_ISSUE_GROUPS || issueGroupKey(group) === selectedKey)
    .flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        groupTitle: group.title,
        actionType: group.actionType,
      })),
    )
})

const issueSummary = computed(() => {
  const items = issueGroups.value.flatMap((group) => group.items)
  return {
    uniqueSources: issueGroups.value.reduce((sum, group) => sum + group.uniqueSourceCount, 0),
    manualSources: items.filter((item) => item.manualResolutionRequired).length,
    replaySources: items.filter((item) => item.replaySupported).length,
  }
})

const candidateReceiptRows = computed(() => {
  const issue = selectedIssue.value
  if (!issue) return []
  return issue.candidateSourceIds
    .map((sourceId) => receiptDetails.value[sourceId])
    .filter((receipt): receipt is DhbWarehousingReceipt => Boolean(receipt))
})

const syncDurationLabel = computed(() => {
  const result = latestResult.value
  if (!result?.startedAt || !result.finishedAt) return '-'
  const startedAt = new Date(result.startedAt).getTime()
  const finishedAt = new Date(result.finishedAt).getTime()
  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt) || finishedAt < startedAt) return '-'
  return `${((finishedAt - startedAt) / 1000).toFixed(1)} 秒`
})

async function runUnifiedSync() {
  await runSync('full', { maxPages: maxPages.value }, '订货宝统一同步已完成')
}

async function runStageSync(stage: SyncStage) {
  await runSync(stage.key, { ...stage.command, maxPages: maxPages.value }, `${stage.label}同步已完成`)
}

async function runSync(stageKey: string, command: DhbSyncOrchestrationCommand, successMessage: string) {
  syncing.value = true
  runningStage.value = stageKey
  syncBusyMessage.value = ''
  try {
    const result = await syncDhbOrchestration(command)
    latestResult.value = result
    if (result.status === 'SUCCEEDED') {
      ElMessage.success(successMessage)
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
    runningStage.value = ''
  }
}

async function loadIssueWorkbench() {
  issueLoading.value = true
  try {
    const [groups, tasks] = await Promise.all([getDhbOpenIssues(500), getDhbSyncTasks()])
    issueGroups.value = groups
    syncTasks.value = tasks
    if (activeIssueGroupKey.value !== ALL_ISSUE_GROUPS
      && !groups.some((group) => issueGroupKey(group) === activeIssueGroupKey.value)) {
      activeIssueGroupKey.value = ALL_ISSUE_GROUPS
    }
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '订货宝待处理闭环加载失败'))
  } finally {
    issueLoading.value = false
  }
}

function openResolution(issue: IssueItemWithAction) {
  selectedIssue.value = issue
  selectedReceiptId.value = issue.candidateSourceIds[0] || ''
  resolutionReason.value = ''
  resolutionDialogVisible.value = true
  void loadCandidateReceipts(issue)
}

async function loadCandidateReceipts(issue: IssueItemWithAction) {
  if (!issue.connectorId || !issue.candidateSourceIds.length) return
  try {
    const page = await queryDhbWarehousingReceipts(issue.connectorId, 0, 200)
    const candidates = new Set(issue.candidateSourceIds)
    const nextDetails: Record<string, DhbWarehousingReceipt> = {}
    for (const receipt of page.items || []) {
      const keys = [receipt.sourceId, receipt.number].filter((value): value is string => Boolean(value))
      for (const key of keys) {
        if (candidates.has(key)) nextDetails[key] = receipt
      }
    }
    receiptDetails.value = { ...receiptDetails.value, ...nextDetails }
  } catch (reason) {
    ElMessage.warning(errorMessage(reason, '候选入库单详情加载失败，可继续按候选单号裁决'))
  }
}

async function submitManualResolution() {
  const issue = selectedIssue.value
  if (!issue) return
  if (!issue.connectorId) {
    ElMessage.warning('当前异常缺少连接器ID，不能保存裁决')
    return
  }
  if (!selectedReceiptId.value) {
    ElMessage.warning('请先选择正确的订货宝入库单')
    return
  }
  resolutionSubmitting.value = true
  try {
    await createDhbManualResolution({
      connectorId: issue.connectorId,
      resolutionType: 'TRANSFER_INBOUND_RECEIPT',
      sourceObjectType: issue.sourceObjectType,
      sourceId: issue.sourceId,
      selectedSourceObjectType: issue.candidateSourceObjectType || 'WAREHOUSING_RECEIPT',
      selectedSourceId: selectedReceiptId.value,
      evidence: {
        candidateSourceIds: issue.candidateSourceIds,
        errorCode: issue.errorCode,
        runId: issue.runId,
      },
      reason: resolutionReason.value.trim() || '人工确认调拨出库与入库关系',
    })
    resolutionDialogVisible.value = false
    ElMessage.success('人工裁决已保存')
    await replayIssue(issue)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '人工裁决保存失败'))
  } finally {
    resolutionSubmitting.value = false
  }
}

async function replayIssue(issue: IssueItemWithAction) {
  const task = orderSyncTask(issue)
  if (!task) {
    ElMessage.warning('未找到启用的订货宝 Order 同步任务，不能单对象重放')
    return
  }
  replayingSourceId.value = issue.sourceId
  try {
    const result = await replayDhbOrderObject(task.id, {
      sourceObjectType: issue.sourceObjectType,
      sourceId: issue.sourceId,
    })
    if (result.status === 'SUCCEEDED') {
      ElMessage.success('单对象重放已完成')
    } else {
      ElMessage.warning(result.errorMessage || '单对象重放未完全成功，请查看同步日志')
    }
    await loadIssueWorkbench()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '单对象重放失败'))
  } finally {
    replayingSourceId.value = ''
  }
}

function orderSyncTask(issue: DhbSyncOpenIssueItem): DhbSyncTask | null {
  return syncTasks.value.find((task) =>
    task.objectType === 'ORDER'
    && task.status !== 'PAUSED'
    && (!issue.connectorId || task.connectorId === issue.connectorId),
  ) || null
}

function issueGroupKey(group: DhbSyncOpenIssueGroup) {
  return [group.category, group.sourceObjectType, group.errorCode || ''].join('|')
}

function actionLabel(actionType: string) {
  const labels: Record<string, string> = {
    MANUAL_RESOLUTION: '人工裁决',
    REPLAY_AFTER_CODE_FIX: '直接重放',
    FIX_MAPPING: '补映射',
    FIX_SOURCE_TIME: '补来源时间',
    REPLAY_AFTER_MAPPING: '映射后重放',
    CODE_REPAIR: '修代码/源字段',
    INVESTIGATE: '排查',
  }
  return labels[actionType] || actionType || '-'
}

function formatTime(value: string | null | undefined) {
  if (!value) return '-'
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return '-'
  return timestamp.toLocaleString('zh-CN', { hour12: false })
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
    SUCCEEDED_WITH_WARNINGS: '有警告',
    PARTIAL: '部分成功',
    FAILED: '失败',
    SKIPPED: '已跳过',
  }
  return labels[status] || status || '-'
}

function statusTag(status: DhbSyncOrchestrationStatus | string): 'success' | 'info' | 'warning' | 'danger' {
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PARTIAL' || status === 'SUCCEEDED_WITH_WARNINGS') return 'warning'
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

onMounted(() => {
  void loadIssueWorkbench()
})

defineExpose({
  activeSectionDetail,
  sections,
  boundaryRules,
  latestSteps,
  syncStages,
  issueGroups,
  visibleIssueItems,
  issueSummary,
  runUnifiedSync,
  runStageSync,
  loadIssueWorkbench,
  openResolution,
  submitManualResolution,
  replayIssue,
})
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
.sync-result,
.issue-workbench {
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

.stage-sync {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 16px;
  border: 1px solid var(--supply-border);
  border-radius: var(--supply-radius);
  background: var(--supply-surface);
}

.stage-sync__heading {
  display: grid;
  gap: 4px;
  min-width: 180px;
}

.stage-sync__heading span {
  color: var(--supply-primary);
  font-size: $font-size-xs;
  font-weight: 700;
}

.stage-sync__heading strong {
  color: var(--supply-text);
  font-size: $font-size-sm;
}

.stage-sync__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.issue-workbench {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.issue-workbench__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.issue-workbench__heading span {
  color: var(--supply-primary);
  font-size: $font-size-xs;
  font-weight: 700;
}

.issue-workbench__heading h2 {
  margin: 6px 0;
  color: var(--supply-text);
  font-size: $font-size-lg;
  font-weight: 700;
}

.issue-workbench__heading p {
  margin: 0;
  color: var(--supply-text-muted);
  font-size: $font-size-sm;
  line-height: 1.55;
}

.issue-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.issue-metrics div {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--supply-border);
  border-radius: var(--supply-radius);
  background: var(--supply-surface-subtle);
}

.issue-metrics span,
.issue-group small {
  display: block;
  color: var(--supply-text-muted);
  font-size: $font-size-xs;
}

.issue-metrics strong,
.issue-group strong {
  display: block;
  margin-top: 4px;
  color: var(--supply-text);
  font-size: $font-size-lg;
  line-height: 1.2;
}

.issue-group-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.issue-group {
  display: grid;
  min-width: 150px;
  max-width: 220px;
  gap: 4px;
  padding: 9px 11px;
  cursor: pointer;
  text-align: left;
  border: 1px solid var(--supply-border);
  border-radius: var(--supply-radius);
  background: #fff;
}

.issue-group--active {
  border-color: var(--supply-primary);
  background: var(--supply-surface-subtle);
}

.issue-group span {
  overflow: hidden;
  color: var(--supply-text);
  font-size: $font-size-sm;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-table {
  width: 100%;
}

.candidate-list,
.issue-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.issue-action-hint,
.muted-text {
  color: var(--supply-text-muted);
  font-size: $font-size-xs;
}

.resolution-dialog {
  display: grid;
  gap: 14px;
}

.resolution-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.resolution-summary div {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--supply-border);
  border-radius: var(--supply-radius);
  background: var(--supply-surface-subtle);
}

.resolution-summary dt,
.resolution-label {
  color: var(--supply-text);
  font-size: $font-size-xs;
  font-weight: 700;
}

.resolution-summary dd {
  margin: 5px 0 0;
  overflow: hidden;
  color: var(--supply-text);
  font-size: $font-size-sm;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resolution-select {
  width: 100%;
}

.candidate-detail-list {
  display: grid;
  gap: 8px;
}

.candidate-detail-list div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--supply-border);
  border-radius: var(--supply-radius);
}

.candidate-detail-list span {
  min-width: 0;
  overflow: hidden;
  color: var(--supply-text-muted);
  font-size: $font-size-xs;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  .sync-operation,
  .stage-sync,
  .issue-workbench__heading {
    flex-direction: column;
    align-items: stretch;
  }

  .operation-actions,
  .stage-sync__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .result-summary {
    grid-template-columns: 1fr;
  }

  .issue-metrics,
  .resolution-summary {
    grid-template-columns: 1fr;
  }

  .issue-group {
    max-width: none;
    flex: 1 1 150px;
  }
}
</style>
