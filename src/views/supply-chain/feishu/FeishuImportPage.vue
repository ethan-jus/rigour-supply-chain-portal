<template>
  <div class="feishu-import-page supply-page supply-page--integration">
    <section class="import-heading">
      <div>
        <span class="eyebrow">外部同步 · 飞书</span>
        <h1>飞书导入中心</h1>
        <p>飞书导出文件先进入统一批次，预检通过后可直接正式导入；历史预检批次可继续执行。</p>
      </div>
      <el-tag type="info" effect="plain">统一导入口</el-tag>
    </section>

    <section class="flow-strip" aria-label="飞书导入流程">
      <div v-for="step in flowSteps" :key="step.key" :class="['flow-step', { 'flow-step--active': activeFlowStep === step.key }]">
        <el-icon><component :is="step.icon" /></el-icon>
        <span>{{ step.label }}</span>
      </div>
    </section>

    <section class="template-panel">
      <div class="history-heading">
        <div>
          <span>导入模板</span>
          <strong>{{ importTemplates.length }} 个</strong>
          <em>按模板识别表、字段、依赖和重复策略。</em>
        </div>
        <el-button :icon="Refresh" :loading="templateLoading" @click="loadTemplates">刷新</el-button>
      </div>
      <el-table :data="importTemplates" border max-height="220" empty-text="暂无导入模板">
        <el-table-column prop="templateName" label="模板" min-width="150" fixed show-overflow-tooltip />
        <el-table-column prop="templateCode" label="编码" min-width="190" show-overflow-tooltip />
        <el-table-column prop="domainCode" label="目标域" width="90" />
        <el-table-column prop="objectType" label="对象" min-width="130" show-overflow-tooltip />
        <el-table-column label="重复判断" min-width="220" show-overflow-tooltip>
          <template #default="scope">{{ deduplicationText(scope.row) }}</template>
        </el-table-column>
        <el-table-column label="依赖" min-width="220" show-overflow-tooltip>
          <template #default="scope">{{ dependencyText(scope.row) }}</template>
        </el-table-column>
      </el-table>
    </section>

    <section class="outcome-panel" :class="`outcome-panel--${importOutcome.tone}`">
      <div class="outcome-copy">
        <span>导入结果</span>
        <strong>{{ importOutcome.title }}</strong>
        <p>{{ importOutcome.description }}</p>
      </div>
      <div class="outcome-state">
        <el-tag :type="importOutcome.tagType" effect="dark">{{ importOutcome.tagLabel }}</el-tag>
        <span>{{ importOutcome.nextAction }}</span>
        <el-button v-if="hasImportProgress" link type="primary" :icon="Upload" @click="scrollToUpload">
          返回导入入口
        </el-button>
      </div>
    </section>

    <section ref="uploadPanelRef" class="import-workbench">
      <div class="upload-panel">
        <el-upload
          drag
          :auto-upload="false"
          multiple
          :limit="50"
          accept=".xlsx"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          :on-exceed="handleFileExceed"
        >
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div class="upload-text">选择飞书导出的 xlsx 文件，可多选</div>
        </el-upload>
      </div>
      <div class="import-actions">
        <div class="source-row">
          <el-input
            v-model="sourceUrl"
            clearable
            placeholder="飞书 Base 或视图地址"
            aria-label="飞书来源地址"
          />
          <el-button
            type="primary"
            :icon="Upload"
            :loading="preflighting"
            :disabled="!selectedFiles.length"
            @click="runPreflight"
          >
            {{ preflightButtonText }}
          </el-button>
        </div>
        <div class="selected-file-card">
          <span>{{ selectedFiles.length ? '已选择文件' : '当前状态' }}</span>
          <strong>{{ selectedFileTitle }}</strong>
          <em>{{ selectedFileMeta }}</em>
        </div>
      </div>
    </section>

    <section v-if="batchRows.length" ref="batchPanelRef" class="batch-panel">
      <div class="history-heading">
        <div>
          <span>批量文件结果</span>
          <strong>{{ batchRows.length }} 个文件</strong>
        </div>
        <div class="section-actions">
          <el-button :icon="Upload" @click="scrollToUpload">返回导入入口</el-button>
          <el-button :icon="Refresh" @click="clearResult">清空结果</el-button>
        </div>
      </div>
      <el-table :data="batchRows" border max-height="360" row-key="id">
        <el-table-column prop="fileName" label="文件" min-width="260" fixed show-overflow-tooltip />
        <el-table-column label="状态" width="140">
          <template #default="scope">
            <el-tag :type="batchRowTag(scope.row)" effect="light">
              {{ batchRowStatusLabel(scope.row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="batchId" label="批次" min-width="240" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.batchId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="totalSheets" label="工作表" width="90" align="right" />
        <el-table-column prop="totalRows" label="数据行" width="100" align="right" />
        <el-table-column prop="duplicateRows" label="重复行" width="100" align="right" />
        <el-table-column prop="attachmentReferenceCount" label="附件引用" width="110" align="right" />
        <el-table-column label="错误/提醒" width="110" align="right">
          <template #default="scope">{{ scope.row.issueErrors }} / {{ scope.row.issueWarnings }}</template>
        </el-table-column>
        <el-table-column prop="message" label="说明" min-width="260" show-overflow-tooltip />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="scope">
            <el-button
              link
              type="primary"
              :disabled="!scope.row.preflightResult"
              @click="selectBatchRow(scope.row)"
            >
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section v-if="!result" class="result-placeholder">
      <div>
        <span>导入结果</span>
        <strong>{{ selectedFiles.length ? '待预检' : '等待文件' }}</strong>
      </div>
      <div class="placeholder-grid">
        <div>
          <span>批次</span>
          <strong>-</strong>
        </div>
        <div>
          <span>工作表</span>
          <strong>-</strong>
        </div>
        <div>
          <span>数据行</span>
          <strong>-</strong>
        </div>
        <div>
          <span>附件引用</span>
          <strong>-</strong>
        </div>
        <div>
          <span>预检问题</span>
          <strong>-</strong>
        </div>
      </div>
    </section>

    <section v-if="result" ref="resultPanelRef" class="result-panel">
      <div class="result-summary">
        <div>
          <span>批次</span>
          <strong>{{ result.batchId }}</strong>
        </div>
        <div>
          <span>状态</span>
          <el-tag :type="statusTag(result.status)" effect="light">{{ statusLabel(result.status) }}</el-tag>
        </div>
        <div>
          <span>工作表</span>
          <strong>{{ result.totalSheets }}</strong>
        </div>
        <div>
          <span>数据行</span>
          <strong>{{ result.totalRows }}</strong>
        </div>
        <div>
          <span>重复行</span>
          <strong>{{ result.duplicateRows }}</strong>
        </div>
        <div>
          <span>附件引用</span>
          <strong>{{ result.attachmentReferenceCount }}</strong>
        </div>
        <div>
          <span>原始文件</span>
          <strong>{{ result.originalFileName }}</strong>
        </div>
        <div>
          <span>文件大小</span>
          <strong>{{ formatBytes(result.fileSizeBytes) }}</strong>
        </div>
        <div>
          <span>预检问题</span>
          <strong>{{ issueSummary.errors }} / {{ issueSummary.warnings }}</strong>
        </div>
      </div>

      <el-alert
        v-if="result.attachmentReferenceCount > 0"
        class="notice-alert"
        type="warning"
        :closable="false"
        show-icon
        title="当前文件包含附件引用；有飞书 Base 地址时正式导入会下载附件并上传 COS，没有附件源时先导入业务主体，附件后续补偿回填。"
      />

      <div v-if="issueActionGroups.length" class="issue-action-panel">
        <div class="issue-action-heading">
          <div>
            <span>预检处理建议</span>
            <strong>
              {{ blockingIssueCount }} 个需先补齐，{{ nonBlockingIssueCount }} 个可后续处理
            </strong>
          </div>
        </div>
        <div class="issue-action-grid">
          <div
            v-for="group in issueActionGroups"
            :key="group.key"
            :class="['issue-action-item', `issue-action-item--${group.tone}`]"
          >
            <div>
              <span>{{ group.label }}</span>
              <strong>{{ group.count }}</strong>
            </div>
            <p>{{ group.hint }}</p>
            <el-tag :type="group.blockingCount ? 'danger' : 'info'" effect="light">
              {{ group.blockingCount ? '阻断对应业务投影' : '不阻断主数据导入' }}
            </el-tag>
          </div>
        </div>
      </div>

      <div class="run-actions">
        <div class="run-options">
          <el-input-number
            v-model="runMaxRows"
            :min="1"
            :max="100000"
            :step="100"
            controls-position="right"
            aria-label="本次执行最大行数"
          />
        </div>
        <el-button
          type="success"
          :icon="Upload"
          :loading="running"
          :disabled="!runnableRows.length"
          @click="runImport"
        >
          {{ runButtonText }}
        </el-button>
        <el-button :icon="Upload" @click="scrollToUpload">继续上传</el-button>
      </div>

      <el-table :data="result.tables" border class="table-preview" max-height="420">
        <el-table-column prop="sheetName" label="工作表" min-width="180" fixed show-overflow-tooltip />
        <el-table-column label="目标域" width="110">
          <template #default="scope">
            <el-tag v-if="scope.row.domainCode" effect="plain">{{ scope.row.domainCode }}</el-tag>
            <span v-else class="muted-text">未识别</span>
          </template>
        </el-table-column>
        <el-table-column prop="objectType" label="对象类型" min-width="150" show-overflow-tooltip />
        <el-table-column label="映射状态" width="150">
          <template #default="scope">
            <el-tag :type="mappingTag(scope.row.mappingStatus)" effect="light">
              {{ mappingLabel(scope.row.mappingStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rowCount" label="行数" width="100" align="right" />
        <el-table-column prop="duplicateRows" label="重复行" width="100" align="right" />
        <el-table-column prop="columnCount" label="列数" width="100" align="right" />
        <el-table-column prop="attachmentReferenceCount" label="附件" width="100" align="right" />
        <el-table-column label="附件字段" min-width="200" show-overflow-tooltip>
          <template #default="scope">
            <div v-if="scope.row.attachmentFields.length" class="tag-list">
              <el-tag v-for="field in scope.row.attachmentFields" :key="field" type="warning" effect="plain">
                {{ field }}
              </el-tag>
            </div>
            <span v-else class="muted-text">-</span>
          </template>
        </el-table-column>
      </el-table>

      <section class="headers-panel">
        <div v-for="table in result.tables" :key="table.sheetName" class="headers-card">
          <div>
            <strong>{{ table.sheetName }}</strong>
            <span>{{ table.headers.length }} 个字段</span>
          </div>
          <div class="field-list">
            <el-tag v-for="header in table.headers" :key="`${table.sheetName}-${header}`" effect="plain">
              {{ header }}
            </el-tag>
          </div>
          <el-table
            v-if="table.sampleRows.length"
            :data="table.sampleRows"
            border
            size="small"
            class="raw-preview-table"
            max-height="260"
          >
            <el-table-column
              v-for="header in visiblePreviewHeaders(table)"
              :key="`${table.sheetName}-${header}-preview`"
              :prop="header"
              :label="header"
              min-width="150"
              show-overflow-tooltip
            >
              <template #default="scope">{{ previewCell(scope.row[header]) }}</template>
            </el-table-column>
          </el-table>
          <p v-else class="muted-text">暂无样例数据</p>
        </div>
      </section>
    </section>

    <section v-if="runResult" ref="runPanelRef" class="run-panel">
      <div class="section-toolbar">
        <div>
          <span>执行结果</span>
          <strong>{{ runResult.dryRun ? '试跑结果，不写入数据库' : '正式导入结果' }}</strong>
        </div>
        <el-button :icon="Upload" @click="scrollToUpload">返回导入入口</el-button>
      </div>
      <div class="result-summary result-summary--run">
        <div>
          <span>执行状态</span>
          <el-tag :type="runStatusTag(runResult.status)" effect="light">
            {{ runStatusLabel(runResult.status, runResult.dryRun) }}
          </el-tag>
        </div>
        <div>
          <span>本次行数</span>
          <strong>{{ runResult.totalRows }}</strong>
        </div>
        <div>
          <span>已投影</span>
          <strong>{{ runResult.projectedRows }}</strong>
        </div>
        <div>
          <span>{{ runResult.dryRun ? '试跑通过' : '已跳过' }}</span>
          <strong>{{ runResult.skippedRows }}</strong>
        </div>
        <div>
          <span>待映射</span>
          <strong>{{ runResult.waitingMappingRows }}</strong>
        </div>
        <div>
          <span>失败</span>
          <strong>{{ runResult.failedRows }}</strong>
        </div>
      </div>
      <div v-if="runIssueGroups.length" class="issue-action-panel run-issue-panel">
        <div class="issue-action-heading">
          <div>
            <span>导入未完成原因</span>
            <strong>{{ runIssueTotal }} 行待处理或失败</strong>
          </div>
        </div>
        <div class="issue-action-grid">
          <div
            v-for="group in runIssueGroups"
            :key="group.key"
            :class="['issue-action-item', `issue-action-item--${group.tone}`]"
          >
            <div>
              <span>{{ group.label }}</span>
              <strong>{{ group.count }}</strong>
            </div>
            <p>{{ group.message }}</p>
            <el-tag :type="group.tagType" effect="light">{{ group.statusLabel }}</el-tag>
          </div>
        </div>
      </div>
      <el-table :data="runResult.rows" border max-height="420">
        <el-table-column prop="sheetName" label="工作表" min-width="150" fixed show-overflow-tooltip />
        <el-table-column prop="rowNumber" label="行号" width="90" align="right" />
        <el-table-column prop="sourceDocumentNo" label="来源单号" min-width="170" show-overflow-tooltip />
        <el-table-column label="投影状态" width="130">
          <template #default="scope">
            <el-tag :type="projectionTag(scope.row.projectionStatus)" effect="light">
              {{ projectionLabel(scope.row.projectionStatus, runResult.dryRun) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="targetDomain" label="目标域" width="110" />
        <el-table-column prop="targetObjectType" label="目标对象" min-width="140" show-overflow-tooltip />
        <el-table-column prop="targetId" label="目标ID" min-width="120" show-overflow-tooltip />
        <el-table-column prop="message" label="说明" min-width="280" show-overflow-tooltip />
      </el-table>
    </section>

    <section v-if="result?.issues.length" class="issue-panel">
      <div class="issue-heading">
        <div>
          <span>预检问题</span>
          <strong>{{ result.issues.length }}</strong>
        </div>
        <div class="section-actions">
          <el-button :icon="Upload" @click="scrollToUpload">返回导入入口</el-button>
          <el-button :icon="Refresh" @click="clearResult">清空结果</el-button>
        </div>
      </div>
      <el-table :data="result.issues" border max-height="340">
        <el-table-column label="级别" width="90">
          <template #default="scope">
            <el-tag :type="issueTag(scope.row.severity)" effect="light">{{ scope.row.severity }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="影响" width="130">
          <template #default="scope">
            <el-tag :type="issueBlocking(scope.row) ? 'danger' : 'info'" effect="light">
              {{ issueBlocking(scope.row) ? '需先补齐' : '可后续处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类别" width="130">
          <template #default="scope">{{ issueCategoryLabel(issueCategory(scope.row)) }}</template>
        </el-table-column>
        <el-table-column prop="issueType" label="类型" min-width="210" show-overflow-tooltip />
        <el-table-column prop="tableName" label="工作表" min-width="160" show-overflow-tooltip />
        <el-table-column prop="fieldName" label="字段" min-width="160" show-overflow-tooltip />
        <el-table-column prop="message" label="说明" min-width="320" show-overflow-tooltip />
        <el-table-column label="处理建议" min-width="360" show-overflow-tooltip>
          <template #default="scope">{{ issueResolutionHint(scope.row) }}</template>
        </el-table-column>
      </el-table>
    </section>

    <section class="history-panel">
      <div class="history-heading">
        <div>
          <span>历史批次</span>
          <strong>最近 {{ importBatches.length }} 个</strong>
          <em>未完成批次可继续导入，已完成批次可按原始行重新导入。</em>
        </div>
        <el-button :icon="Refresh" :loading="historyLoading" @click="loadHistory">刷新</el-button>
      </div>
      <el-table
        :data="importBatches"
        border
        max-height="320"
        empty-text="暂无飞书导入批次"
      >
        <el-table-column label="上传时间" width="170">
          <template #default="scope">{{ formatTime(scope.row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="130">
          <template #default="scope">
            <el-tag :type="statusTag(scope.row.status)" effect="light">
              {{ statusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="originalFileName" label="原始文件" min-width="210" show-overflow-tooltip />
        <el-table-column prop="totalSheets" label="表" width="80" align="right" />
        <el-table-column prop="totalRows" label="行" width="100" align="right" />
        <el-table-column prop="duplicateRows" label="重复行" width="100" align="right" />
        <el-table-column prop="attachmentReferenceCount" label="附件引用" width="110" align="right" />
        <el-table-column label="文件大小" width="110" align="right">
          <template #default="scope">{{ formatBytes(scope.row.fileSizeBytes) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button
              v-if="canRunHistoryBatch(scope.row)"
              link
              type="primary"
              :loading="runningHistoryBatchId === scope.row.batchId"
              :disabled="running || preflighting"
              @click="runHistoryBatch(scope.row)"
            >
              {{ historyRunButtonLabel(scope.row) }}
            </el-button>
            <el-tag v-else effect="plain" :type="historyActionTag(scope.row.status)">
              {{ historyActionLabel(scope.row) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <div v-if="hasImportProgress" class="floating-import-actions">
      <el-button type="primary" :icon="Upload" @click="scrollToUpload">返回导入入口</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, type UploadFile, type UploadFiles } from 'element-plus'
import { CircleCheck, DocumentChecked, Refresh, Upload, UploadFilled, View } from '@element-plus/icons-vue'
import {
  getFeishuImportBatches,
  getFeishuImportRunStatus,
  getFeishuImportTemplates,
  preflightFeishuImportBundle,
  preflightFeishuImportBundleFiles,
  runFeishuImportBundle,
  type FeishuImportBatchSummary,
  type FeishuImportIssue,
  type FeishuImportPreflightResult,
  type FeishuImportRunIssueSummary,
  type FeishuImportRunResult,
  type FeishuImportRunRow,
  type FeishuImportTablePreview,
  type FeishuImportTemplate,
} from '@/api/core/feishu-import'

interface ImportFileRow {
  id: string
  file: File
  fileName: string
  fileSizeBytes: number
  status: string
  batchId: string | null
  totalSheets: number
  totalRows: number
  duplicateRows: number
  attachmentReferenceCount: number
  issueErrors: number
  issueWarnings: number
  message: string
  preflightResult: FeishuImportPreflightResult | null
  runResult: FeishuImportRunResult | null
}

const selectedFiles = ref<File[]>([])
const sourceUrl = ref('')
const preflighting = ref(false)
const running = ref(false)
const runMaxRows = ref(100000)
const dryRun = ref(false)
const result = ref<FeishuImportPreflightResult | null>(null)
const runResult = ref<FeishuImportRunResult | null>(null)
const lastOperationError = ref<string | null>(null)
const batchRows = ref<ImportFileRow[]>([])
const importBatches = ref<FeishuImportBatchSummary[]>([])
const importTemplates = ref<FeishuImportTemplate[]>([])
const historyLoading = ref(false)
const templateLoading = ref(false)
const runningHistoryBatchId = ref<string | null>(null)
const uploadPanelRef = ref<HTMLElement | null>(null)
const batchPanelRef = ref<HTMLElement | null>(null)
const resultPanelRef = ref<HTMLElement | null>(null)
const runPanelRef = ref<HTMLElement | null>(null)
let importPollSequence = 0

const flowSteps = [
  { key: 'upload', label: '上传预检', icon: Upload },
  { key: 'review', label: '问题确认', icon: View },
  { key: 'run', label: '执行写入', icon: DocumentChecked },
  { key: 'done', label: '结果复核', icon: CircleCheck },
] as const

const RUN_TERMINAL_STATUSES = new Set(['SUCCEEDED', 'PARTIAL', 'FAILED', 'DRY_RUN'])
const IMPORT_POLL_INTERVAL_MS = 2000
const IMPORT_POLL_MAX_ATTEMPTS = 900

const issueGroupDefinitions = [
  {
    key: 'FIELD_MAPPING',
    label: '字段映射',
    tone: 'warning',
    hint: '需要在补齐中心维护来源字段、目标字段和领域写入规则，补齐后再重跑投影。',
  },
  {
    key: 'TABLE_MAPPING',
    label: '表识别',
    tone: 'danger',
    hint: '需要先配置工作表模板和目标业务对象，否则系统不知道应该写入哪个业务表。',
  },
  {
    key: 'DATA_QUALITY',
    label: '数据质量',
    tone: 'warning',
    hint: '来源单号或创建时间会影响幂等、关联关系和内部编码，需要补齐或配置替代字段。',
  },
  {
    key: 'ATTACHMENT',
    label: '附件入库',
    tone: 'info',
    hint: '正式导入会先写入业务主体；权限、Base 地址或附件 token 不满足时，附件单独标记待补齐。',
  },
  {
    key: 'DUPLICATE',
    label: '重复数据',
    tone: 'info',
    hint: '同批次完全重复会跳过；历史重复会重新校验业务库，已存在无变化才跳过，有变化则更新。',
  },
  {
    key: 'SOURCE_FILE',
    label: '源文件问题',
    tone: 'danger',
    hint: '源 Excel 缺少必需表头或超过限制，需要修正文件后重新预检。',
  },
  {
    key: 'OTHER',
    label: '其他提醒',
    tone: 'info',
    hint: '需要结合问题明细判断是否修正源数据或导入配置。',
  },
] as const

const activeFlowStep = computed(() => {
  if (runResult.value) return 'done'
  if (running.value) return 'run'
  if (result.value) return 'review'
  return 'upload'
})

const runnableRows = computed(() => batchRows.value.filter((row) =>
  Boolean(row.batchId)
  && row.preflightResult
  && row.status !== 'REJECTED'
  && row.status !== 'RUNNING',
))

const hasImportProgress = computed(() =>
  selectedFiles.value.length > 0 || batchRows.value.length > 0 || Boolean(result.value) || Boolean(runResult.value),
)

const issueSummary = computed(() => {
  const issues = result.value?.issues ?? []
  return {
    errors: issues.filter((issue) => issue.severity === 'ERROR').length,
    warnings: issues.filter((issue) => issue.severity === 'WARN').length,
  }
})

const blockingIssueCount = computed(() =>
  (result.value?.issues ?? []).filter((issue) => issueBlocking(issue)).length,
)

const nonBlockingIssueCount = computed(() =>
  (result.value?.issues ?? []).filter((issue) => !issueBlocking(issue)).length,
)

const issueActionGroups = computed(() => issueGroupDefinitions
  .map((definition) => {
    const issues = (result.value?.issues ?? []).filter((issue) => issueCategory(issue) === definition.key)
    const blockingCount = issues.filter((issue) => issueBlocking(issue)).length
    return {
      ...definition,
      count: issues.length,
      blockingCount,
    }
  })
  .filter((group) => group.count > 0))

const runIssueSummaries = computed(() => {
  const summaries = runResult.value?.issueSummaries ?? []
  if (summaries.length) return summaries
  return fallbackRunIssueSummaries(runResult.value?.rows ?? [])
})

const runIssueTotal = computed(() =>
  runIssueSummaries.value.reduce((sum, item) => sum + (item.rowCount || 0), 0),
)

const runIssueGroups = computed(() => runIssueSummaries.value
  .map((item, index) => {
    const status = item.projectionStatus || 'PENDING'
    const tagType = status === 'FAILED'
      ? 'danger'
      : (status === 'WAITING_MAPPING' || status === 'PENDING' ? 'warning' : 'info')
    return {
      key: `${item.issueCategory}-${status}-${item.targetDomain ?? '-'}-${item.targetObjectType ?? '-'}-${index}`,
      label: issueCategoryLabel(item.issueCategory),
      count: item.rowCount || 0,
      message: item.message || projectionLabel(status),
      projectionStatus: status,
      statusLabel: projectionLabel(status),
      tagType,
      tone: tagType === 'danger' ? 'danger' : (item.issueCategory === 'ATTACHMENT' ? 'info' : 'warning'),
    }
  })
  .filter((group) => group.count > 0))

const selectedFileTitle = computed(() => {
  if (!selectedFiles.value.length) return '未选择飞书导出的 xlsx 文件'
  if (selectedFiles.value.length === 1) return selectedFiles.value[0]?.name ?? '-'
  return `已选择 ${selectedFiles.value.length} 个飞书导出文件`
})

const selectedFileMeta = computed(() => {
  if (!selectedFiles.value.length) return '等待上传'
  const totalSize = selectedFiles.value.reduce((sum, file) => sum + file.size, 0)
  return `${formatBytes(totalSize)} · ${selectedFiles.value.length} 个文件 · ${selectedFileState.value}`
})

const selectedFileState = computed(() => {
  if (!selectedFiles.value.length) return '等待上传'
  if (preflighting.value) return '预检中'
  if (running.value) return dryRun.value ? '试跑中' : '写入中'
  if (batchRows.value.some((row) => row.runResult)) return '已执行'
  if (batchRows.value.some((row) => row.preflightResult)) return '已预检'
  return '待预检'
})

const preflightButtonText = computed(() => {
  const count = selectedFiles.value.length
  if (!count) return '开始预检'
  return count === 1 ? '开始预检' : `开始预检 ${count} 个文件`
})

const runButtonText = computed(() => {
  const count = runnableRows.value.length
  if (!count) return dryRun.value ? '开始试跑' : '正式导入'
  return count === 1
    ? (dryRun.value ? '开始试跑' : '正式导入')
    : (dryRun.value ? `开始试跑 ${count} 个批次` : `正式导入 ${count} 个批次`)
})

const importOutcome = computed(() => {
  if (lastOperationError.value) {
    return {
      tone: 'danger',
      tagType: 'danger',
      tagLabel: '失败',
      title: '导入请求失败',
      description: lastOperationError.value,
      nextAction: '排查错误后重新预检或执行。',
    }
  }
  if (running.value) {
    return {
      tone: 'active',
      tagType: 'primary',
      tagLabel: dryRun.value ? '试跑中' : '写入中',
      title: dryRun.value ? '正在试跑导入规则' : '正在正式导入系统',
      description: dryRun.value ? '当前只校验映射和投影链路，不会写入业务表。' : '当前正在把预检批次写入业务表。',
      nextAction: '等待执行结果返回。',
    }
  }
  if (preflighting.value) {
    return {
      tone: 'active',
      tagType: 'primary',
      tagLabel: '预检中',
      title: '正在检查飞书导出文件',
      description: '系统正在保存批次原始文件、识别工作表、解析字段和附件引用。',
      nextAction: '等待预检结果返回。',
    }
  }
  if (batchRows.value.length > 1) {
    const rows = batchRows.value
    const total = rows.length
    const failed = rows.filter((row) => row.status === 'FAILED').length
    const rejected = rows.filter((row) => row.status === 'REJECTED').length
    const preflighted = rows.filter((row) => row.preflightResult).length
    const runRows = rows.filter((row) => row.runResult)
    const runFailed = runRows.filter((row) => row.runResult?.status === 'FAILED').length
    const runPartial = runRows.filter((row) =>
      row.runResult?.status === 'PARTIAL'
      || (row.runResult?.failedRows ?? 0) > 0
      || (row.runResult?.waitingMappingRows ?? 0) > 0,
    ).length
    const totalRows = rows.reduce((sum, row) => sum + row.totalRows, 0)
    const totalDuplicates = rows.reduce((sum, row) => sum + row.duplicateRows, 0)
    const totalAttachments = rows.reduce((sum, row) => sum + row.attachmentReferenceCount, 0)

    if (runRows.length > 0) {
      const dryRunMode = runRows.every((row) => row.runResult?.dryRun)
      if (failed > 0 || runFailed > 0 || runPartial > 0 || runRows.length < rows.filter((row) => row.batchId).length) {
        return {
          tone: 'warning',
          tagType: 'warning',
          tagLabel: dryRunMode ? '试跑部分通过' : '部分写入',
          title: dryRunMode ? '批量试跑存在待处理文件' : '批量导入只完成了一部分',
          description: `共 ${total} 个文件，已执行 ${runRows.length} 个，失败 ${failed + runFailed} 个，部分完成 ${runPartial} 个。`,
          nextAction: '查看下方批量文件结果。',
        }
      }
      return {
        tone: 'success',
        tagType: 'success',
        tagLabel: dryRunMode ? '试跑通过' : '写入成功',
        title: dryRunMode ? '批量试跑通过，尚未写入数据库' : '批量正式导入完成',
        description: dryRunMode
          ? `共 ${total} 个文件，试跑通过 ${runRows.reduce((sum, row) => sum + (row.runResult?.skippedRows ?? 0), 0)} 行，尚未写入数据库。`
          : `共 ${total} 个文件、${totalRows} 行、${totalDuplicates} 行重复、${totalAttachments} 个附件引用。`,
        nextAction: dryRunMode ? '确认无误后执行正式导入。' : '进入业务页面复核数据闭环。',
      }
    }

    if (failed > 0 || rejected > 0) {
      return {
        tone: preflighted > 0 ? 'warning' : 'danger',
        tagType: preflighted > 0 ? 'warning' : 'danger',
        tagLabel: preflighted > 0 ? '部分预检通过' : '预检失败',
        title: preflighted > 0 ? '部分文件预检通过，部分失败' : '批量预检未通过',
        description: `共 ${total} 个文件，预检通过 ${preflighted} 个，失败 ${failed + rejected} 个。`,
        nextAction: '查看下方每个文件的失败说明。',
      }
    }

    if (preflighted === total && total > 0) {
      return {
        tone: 'success',
        tagType: 'success',
        tagLabel: '预检通过',
        title: '批量预检通过，尚未写入数据库',
        description: `共 ${total} 个文件、${totalRows} 行、${totalDuplicates} 行重复、${totalAttachments} 个附件引用。`,
        nextAction: '确认后执行正式导入。',
      }
    }

    return {
      tone: 'idle',
      tagType: 'info',
      tagLabel: '待预检',
      title: '多个文件已选择，还没有产生导入结果',
      description: `当前已选择 ${total} 个 Excel，系统还没有读取、生成批次或写入。`,
      nextAction: '点击右侧“开始预检”。',
    }
  }
  if (runResult.value) {
    if (runResult.value.status === 'RUNNING') {
      return {
        tone: 'active',
        tagType: 'primary',
        tagLabel: '导入中',
        title: '后台导入仍在执行',
        description: `已投影 ${runResult.value.projectedRows} 行，失败 ${runResult.value.failedRows} 行，待处理 ${runResult.value.waitingMappingRows} 行。`,
        nextAction: '可稍后刷新历史批次或继续查看执行结果。',
      }
    }
    if (runResult.value.status === 'FAILED') {
      return {
        tone: 'danger',
        tagType: 'danger',
        tagLabel: runResult.value.dryRun ? '试跑失败' : '导入失败',
        title: runResult.value.dryRun ? '试跑未通过' : '正式导入失败',
        description: `本次处理 ${runResult.value.totalRows} 行，失败 ${runResult.value.failedRows} 行，待映射 ${runResult.value.waitingMappingRows} 行。`,
        nextAction: '查看下方失败行说明后修正映射或源文件。',
      }
    }
    if (runResult.value.status === 'PARTIAL' || runResult.value.waitingMappingRows > 0 || runResult.value.failedRows > 0) {
      const attachmentPending = (runResult.value.failedAttachmentRows ?? 0) > 0
      const onlyAttachmentPending = attachmentPending
        && runResult.value.failedRows === 0
        && runResult.value.waitingMappingRows === 0
      return {
        tone: 'warning',
        tagType: 'warning',
        tagLabel: runResult.value.dryRun ? '试跑部分通过' : '部分写入',
        title: onlyAttachmentPending
          ? '业务数据已写入，附件等待补偿'
          : (runResult.value.dryRun ? '试跑存在待处理行' : '导入只完成了一部分'),
        description: `本次处理 ${runResult.value.totalRows} 行，已投影 ${runResult.value.projectedRows} 行，待映射 ${runResult.value.waitingMappingRows} 行，失败 ${runResult.value.failedRows} 行，附件待补偿 ${runResult.value.failedAttachmentRows ?? 0} 行。`,
        nextAction: onlyAttachmentPending
          ? '进入业务页面复核数据；附件权限恢复或补偿后再回填 COS。'
          : '先处理待映射和失败行，再继续正式导入。',
      }
    }
    return {
      tone: 'success',
      tagType: 'success',
      tagLabel: runResult.value.dryRun ? '试跑通过' : '写入成功',
      title: runResult.value.dryRun ? '试跑通过，尚未写入数据库' : '正式导入完成',
      description: runResult.value.dryRun
        ? `本次试跑 ${runResult.value.totalRows} 行，可写入 ${runResult.value.skippedRows} 行，未写入数据库。`
        : `本次处理 ${runResult.value.totalRows} 行，已投影 ${runResult.value.projectedRows} 行，失败 0 行。`,
      nextAction: runResult.value.dryRun ? '确认无误后执行正式导入。' : '进入业务页面复核数据闭环。',
    }
  }
  if (result.value) {
    if (result.value.status === 'REJECTED' || issueSummary.value.errors > 0) {
      return {
        tone: 'danger',
        tagType: 'danger',
        tagLabel: '预检失败',
        title: '预检未通过，不会写入数据库',
        description: `发现 ${issueSummary.value.errors} 个错误、${issueSummary.value.warnings} 个提醒。`,
        nextAction: '先处理下方预检问题。',
      }
    }
    if (blockingIssueCount.value > 0) {
      return {
        tone: 'warning',
        tagType: 'warning',
        tagLabel: '需补齐',
        title: '预检通过，但部分表需要补齐后才能落业务表',
        description: `发现 ${blockingIssueCount.value} 个会阻断业务投影的问题、${nonBlockingIssueCount.value} 个可后续处理的问题。`,
        nextAction: '先处理字段映射、来源单号或创建时间缺口。',
      }
    }
    if (attachmentIssueCount(result.value.issues) > 0) {
      return {
        tone: 'warning',
        tagType: 'warning',
        tagLabel: '附件待入库',
        title: '预检通过，附件可随导入或后续补偿',
        description: `识别 ${result.value.totalSheets} 个工作表、${result.value.totalRows} 行、${result.value.attachmentReferenceCount} 个附件引用。`,
        nextAction: '可先正式导入业务主体；附件未入库的行会进入待补偿。',
      }
    }
    if (result.value.issues.length > 0) {
      return {
        tone: 'warning',
        tagType: 'warning',
        tagLabel: '有待处理项',
        title: '预检通过，但存在提醒',
        description: `识别 ${result.value.totalSheets} 个工作表、${result.value.totalRows} 行、${result.value.duplicateRows} 行重复、${result.value.attachmentReferenceCount} 个附件引用。`,
        nextAction: '确认后执行正式导入。',
      }
    }
    return {
      tone: 'success',
      tagType: 'success',
      tagLabel: '预检通过',
      title: '预检通过，尚未写入数据库',
      description: `识别 ${result.value.totalSheets} 个工作表、${result.value.totalRows} 行、${result.value.duplicateRows} 行重复、${result.value.attachmentReferenceCount} 个附件引用。`,
      nextAction: '确认后执行正式导入。',
    }
  }
  if (selectedFiles.value.length) {
    return {
      tone: 'idle',
      tagType: 'info',
      tagLabel: '待预检',
      title: '文件已选择，还没有产生导入结果',
      description: '当前只是浏览器选择了本地文件，系统还没有读取、生成批次或写入。',
      nextAction: '点击右侧“开始预检”。',
    }
  }
  return {
    tone: 'idle',
    tagType: 'info',
    tagLabel: '未开始',
    title: '还没有导入结果',
    description: '先选择飞书导出的 xlsx 文件，再执行预检。',
    nextAction: '选择文件后开始预检。',
  }
})

onMounted(() => {
  void loadHistory()
  void loadTemplates()
})

onBeforeUnmount(() => {
  importPollSequence += 1
})

function handleFileChange(_uploadFile: UploadFile, uploadFiles: UploadFiles) {
  syncSelectedFiles(uploadFiles)
  lastOperationError.value = null
  result.value = null
  runResult.value = null
}

function handleFileRemove(_uploadFile: UploadFile, uploadFiles: UploadFiles) {
  syncSelectedFiles(uploadFiles)
  lastOperationError.value = null
  result.value = null
  runResult.value = null
}

function handleFileExceed() {
  ElMessage.warning('一次最多选择 50 个飞书导出的 xlsx 文件')
}

async function runPreflight() {
  if (!selectedFiles.value.length) {
    ElMessage.warning('请先选择飞书导出的 xlsx 文件')
    return
  }
  const rows = ensureBatchRows()
  const unitText = selectedFiles.value.length > 1 ? '批次' : '文件'
  let success = 0
  let failed = 0
  try {
    preflighting.value = true
    lastOperationError.value = null
    runResult.value = null
    result.value = null
    for (const row of rows) {
      row.status = 'PREFLIGHTING'
      row.message = '预检中'
      row.batchId = null
      row.preflightResult = null
      row.runResult = null
      row.totalSheets = 0
      row.totalRows = 0
      row.duplicateRows = 0
      row.attachmentReferenceCount = 0
      row.issueErrors = 0
      row.issueWarnings = 0
      try {
        const preflight = selectedFiles.value.length > 1
          ? await preflightFeishuImportBundleFiles(selectedFiles.value, sourceUrl.value.trim() || null)
          : await preflightFeishuImportBundle(row.file, sourceUrl.value.trim() || null)
        applyPreflightResult(row, preflight)
        result.value = preflight
        success += preflight.status === 'REJECTED' ? 0 : 1
        failed += preflight.status === 'REJECTED' ? 1 : 0
      } catch (reason) {
        row.status = 'FAILED'
        row.message = errorMessage(reason, '飞书导入预检失败')
        failed += 1
      }
    }
    if (success && failed) {
      ElMessage.warning(`飞书导入预检部分完成：成功 ${success} 个${unitText}，失败 ${failed} 个${unitText}`)
    } else if (failed) {
      ElMessage.error(`飞书导入预检失败：${failed} 个${unitText}未通过`)
      lastOperationError.value = rows[0]?.message || '飞书导入预检失败'
    } else {
      ElMessage.success(`飞书导入预检完成：${success} 个${unitText}`)
    }
    await loadHistory(false)
    await nextTick()
    const target = resultPanelRef.value || batchPanelRef.value
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (reason) {
    const message = errorMessage(reason, '飞书导入预检失败')
    lastOperationError.value = message
    ElMessage.error(message)
  } finally {
    preflighting.value = false
  }
}

async function runImport() {
  const rows = runnableRows.value
  if (!rows.length) {
    ElMessage.warning('请先完成飞书导入预检')
    return
  }
  let success = 0
  let failed = 0
  try {
    running.value = true
    lastOperationError.value = null
    runResult.value = null
    for (const row of rows) {
      if (!row.batchId) continue
      row.status = 'RUNNING'
      row.message = dryRun.value ? '试跑中' : '写入中'
      try {
        const run = await runAndTrackBatch(row.batchId, shouldReplayCurrentRun(), (current) => {
          row.runResult = current
          row.status = current.status
          row.message = runSummary(current)
        })
        runResult.value = run
        if (row.preflightResult) result.value = row.preflightResult
        if (run.status === 'FAILED') failed += 1
        else success += 1
      } catch (reason) {
        row.status = 'FAILED'
        row.message = errorMessage(reason, '飞书导入执行失败')
        if (row.preflightResult) result.value = row.preflightResult
        failed += 1
      }
    }
    if (success && failed) {
      ElMessage.warning(`飞书导入执行部分完成：成功 ${success} 个，失败 ${failed} 个`)
    } else if (failed) {
      ElMessage.error(`飞书导入执行失败：${failed} 个批次未通过`)
      lastOperationError.value = rows[0]?.message || '飞书导入执行失败'
    } else {
      ElMessage.success(dryRun.value ? `飞书导入试跑完成：${success} 个批次` : `飞书导入完成：${success} 个批次`)
    }
    await loadHistory(false)
    await nextTick()
    const target = runPanelRef.value || batchPanelRef.value
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (reason) {
    const message = errorMessage(reason, '飞书导入执行失败')
    lastOperationError.value = message
    ElMessage.error(message)
  } finally {
    running.value = false
  }
}

async function runHistoryBatch(batch: FeishuImportBatchSummary) {
  if (!canRunHistoryBatch(batch)) {
    ElMessage.warning('当前历史批次状态不允许继续导入')
    return
  }
  try {
    running.value = true
    runningHistoryBatchId.value = batch.batchId
    lastOperationError.value = null
    result.value = null
    runResult.value = null
    const run = await runAndTrackBatch(
      batch.batchId,
      shouldReplayCurrentRun() || shouldReplayHistoryBatch(batch.status) || batch.status === 'RUNNING',
    )
    runResult.value = run
    if (run.status === 'FAILED') {
      ElMessage.error(runSummary(run))
    } else if (run.status === 'PARTIAL' || run.failedRows > 0 || run.waitingMappingRows > 0) {
      ElMessage.warning(runSummary(run))
    } else {
      ElMessage.success(runSummary(run))
    }
    await loadHistory(false)
    await nextTick()
    runPanelRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (reason) {
    const message = errorMessage(reason, '历史批次继续导入失败')
    lastOperationError.value = message
    ElMessage.error(message)
  } finally {
    runningHistoryBatchId.value = null
    running.value = false
  }
}

async function runAndTrackBatch(
  batchId: string,
  replayProjected: boolean,
  onProgress?: (run: FeishuImportRunResult) => void,
) {
  const sequence = ++importPollSequence
  const submitted = await runFeishuImportBundle(batchId, {
    maxRows: runMaxRows.value,
    dryRun: dryRun.value,
    replayProjected,
    async: !dryRun.value,
  })
  onProgress?.(submitted)
  runResult.value = submitted
  if (dryRun.value || isTerminalRunStatus(submitted.status)) return submitted
  return pollImportRun(batchId, sequence, onProgress)
}

async function pollImportRun(
  batchId: string,
  sequence: number,
  onProgress?: (run: FeishuImportRunResult) => void,
) {
  let current = runResult.value
  for (let attempt = 0; attempt < IMPORT_POLL_MAX_ATTEMPTS; attempt += 1) {
    await delay(IMPORT_POLL_INTERVAL_MS)
    if (sequence !== importPollSequence) return current ?? await getFeishuImportRunStatus(batchId, runStatusRowLimit())
    current = await getFeishuImportRunStatus(batchId, runStatusRowLimit())
    runResult.value = current
    onProgress?.(current)
    if (isTerminalRunStatus(current.status)) return current
  }
  return current ?? await getFeishuImportRunStatus(batchId, runStatusRowLimit())
}

function isTerminalRunStatus(status: string) {
  return RUN_TERMINAL_STATUSES.has(status)
}

function runStatusRowLimit() {
  return Math.max(1, Math.min(runMaxRows.value || 500, 1000))
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function loadHistory(showError = true) {
  try {
    historyLoading.value = true
    importBatches.value = await getFeishuImportBatches(20)
  } catch (reason) {
    if (showError) ElMessage.error(errorMessage(reason, '飞书导入批次加载失败'))
  } finally {
    historyLoading.value = false
  }
}

async function loadTemplates(showError = true) {
  try {
    templateLoading.value = true
    importTemplates.value = await getFeishuImportTemplates()
  } catch (reason) {
    if (showError) ElMessage.error(errorMessage(reason, '飞书导入模板加载失败'))
  } finally {
    templateLoading.value = false
  }
}

function deduplicationText(template: FeishuImportTemplate) {
  if (template.deduplicationStrategy === 'SOURCE_DOCUMENT_NO') return '来源单号'
  if (template.deduplicationStrategy === 'ROW_HASH') return '整行内容'
  if (template.deduplicationFields.length) return template.deduplicationFields.join('、')
  return template.deduplicationStrategy || '-'
}

function dependencyText(template: FeishuImportTemplate) {
  if (!template.dependencies.length) return '-'
  return template.dependencies
    .map((dependency) => `${dependency.dependsOnTemplateCode}/${dependency.relationKind}`)
    .join('；')
}

function clearResult() {
  result.value = null
  runResult.value = null
  lastOperationError.value = null
  batchRows.value = []
}

function scrollToUpload() {
  uploadPanelRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function syncSelectedFiles(uploadFiles: UploadFiles) {
  const validFiles = uploadFiles
    .map((item) => item.raw)
    .filter((file): file is File => Boolean(file))
    .filter((file) => file.name.toLowerCase().endsWith('.xlsx'))
  selectedFiles.value = validFiles
  if (validFiles.length > 1) {
    const bundleKey = bundleFileKey(validFiles)
    const existing = batchRows.value.find((row) => row.id === bundleKey)
    batchRows.value = [existing ?? createBatchBundleRow(validFiles)]
    return
  }
  const existingRows = new Map(batchRows.value.map((row) => [fileKey(row.file), row]))
  batchRows.value = validFiles.map((file) => existingRows.get(fileKey(file)) ?? createBatchRow(file))
}

function ensureBatchRows() {
  if (selectedFiles.value.length > 1) {
    const bundleKey = bundleFileKey(selectedFiles.value)
    const existing = batchRows.value.find((row) => row.id === bundleKey)
    batchRows.value = [existing ?? createBatchBundleRow(selectedFiles.value)]
    return batchRows.value
  }
  const existingRows = new Map(batchRows.value.map((row) => [fileKey(row.file), row]))
  batchRows.value = selectedFiles.value.map((file) => existingRows.get(fileKey(file)) ?? createBatchRow(file))
  return batchRows.value
}

function createBatchBundleRow(files: File[]): ImportFileRow {
  const first = files[0]!
  const fileSizeBytes = files.reduce((sum, file) => sum + file.size, 0)
  return {
    id: bundleFileKey(files),
    file: first,
    fileName: `批量导入（${files.length} 个文件）`,
    fileSizeBytes,
    status: 'WAITING',
    batchId: null,
    totalSheets: 0,
    totalRows: 0,
    duplicateRows: 0,
    attachmentReferenceCount: 0,
    issueErrors: 0,
    issueWarnings: 0,
    message: '等待批量预检',
    preflightResult: null,
    runResult: null,
  }
}

function createBatchRow(file: File): ImportFileRow {
  return {
    id: fileKey(file),
    file,
    fileName: file.name,
    fileSizeBytes: file.size,
    status: 'WAITING',
    batchId: null,
    totalSheets: 0,
    totalRows: 0,
    duplicateRows: 0,
    attachmentReferenceCount: 0,
    issueErrors: 0,
    issueWarnings: 0,
    message: '等待预检',
    preflightResult: null,
    runResult: null,
  }
}

function applyPreflightResult(row: ImportFileRow, preflight: FeishuImportPreflightResult) {
  const errors = preflight.issues.filter((issue) => issue.severity === 'ERROR').length
  const warnings = preflight.issues.filter((issue) => issue.severity === 'WARN').length
  row.status = preflight.status
  row.batchId = preflight.batchId
  row.totalSheets = preflight.totalSheets
  row.totalRows = preflight.totalRows
  row.duplicateRows = preflight.duplicateRows
  row.attachmentReferenceCount = preflight.attachmentReferenceCount
  row.issueErrors = errors
  row.issueWarnings = warnings
  row.preflightResult = preflight
  row.runResult = null
  if (preflight.status === 'REJECTED') {
    row.message = `预检未通过：${errors} 个错误，${warnings} 个提醒`
  } else if (warnings > 0) {
    row.message = `预检通过但有提醒：${warnings} 个`
  } else {
    row.message = '预检通过，尚未写入数据库'
  }
}

function runSummary(run: FeishuImportRunResult) {
  const attachmentText = run.uploadedAttachmentCount || run.failedAttachmentRows
    ? `，附件已上传 ${run.uploadedAttachmentCount || 0} 个，附件待补偿 ${run.failedAttachmentRows || 0} 行`
    : ''
  if (run.status === 'RUNNING') {
    return `${run.dryRun ? '试跑' : '后台导入'}进行中：已投影 ${run.projectedRows} 行，失败 ${run.failedRows} 行，待映射 ${run.waitingMappingRows} 行${attachmentText}`
  }
  if (run.status === 'FAILED') {
    return `${run.dryRun ? '试跑' : '导入'}失败：${run.failedRows} 行失败，${run.waitingMappingRows} 行待映射${attachmentText}`
  }
  if (run.status === 'PARTIAL' || run.failedRows > 0 || run.waitingMappingRows > 0) {
    return `${run.dryRun ? '试跑' : '导入'}部分完成：已投影 ${run.projectedRows} 行已写入业务库，失败 ${run.failedRows} 行，待映射 ${run.waitingMappingRows} 行${attachmentText}`
  }
  return run.dryRun
    ? `试跑通过：${run.totalRows} 行，尚未写入数据库`
    : `正式导入完成：${run.projectedRows} 行${attachmentText}`
}

function visiblePreviewHeaders(table: FeishuImportTablePreview) {
  return table.headers.filter((header) => header && header.trim()).slice(0, 18)
}

function previewCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function selectBatchRow(row: ImportFileRow) {
  if (!row.preflightResult) return
  result.value = row.preflightResult
  runResult.value = row.runResult
  void nextTick(() => resultPanelRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function batchRowTag(row: ImportFileRow) {
  if (row.status === 'PREFLIGHTING' || row.status === 'RUNNING') return 'primary'
  if (row.status === 'PREFLIGHTED' || row.status === 'SUCCEEDED') return 'success'
  if (row.status === 'PREFLIGHTED_WITH_WARNINGS' || row.status === 'PARTIAL') return 'warning'
  if (row.status === 'REJECTED' || row.status === 'FAILED') return 'danger'
  return 'info'
}

function batchRowStatusLabel(row: ImportFileRow) {
  if (row.runResult) return runStatusLabel(row.runResult.status, row.runResult.dryRun)
  const labels: Record<string, string> = {
    WAITING: '待预检',
    PREFLIGHTING: '预检中',
    RUNNING: dryRun.value ? '试跑中' : '写入中',
    FAILED: '失败',
  }
  return labels[row.status] ?? statusLabel(row.status)
}

function fileKey(file: File) {
  return `${file.name}__${file.size}__${file.lastModified}`
}

function bundleFileKey(files: File[]) {
  return files.map(fileKey).join('||')
}

function statusTag(status: string) {
  if (status === 'RUNNING') return 'primary'
  if (status === 'PREFLIGHTED' || status === 'SUCCEEDED') return 'success'
  if (status === 'PREFLIGHTED_WITH_WARNINGS' || status === 'PARTIAL') return 'warning'
  if (status === 'REJECTED' || status === 'FAILED') return 'danger'
  return 'info'
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PREFLIGHTED: '预检通过',
    PREFLIGHTED_WITH_WARNINGS: '有待处理项',
    REJECTED: '未通过',
    RUNNING: '导入中',
    SUCCEEDED: '完成',
    PARTIAL: '部分完成',
    FAILED: '失败',
  }
  return labels[status] ?? status
}

function canRunHistoryBatch(batch: FeishuImportBatchSummary) {
  return ['PREFLIGHTED', 'PREFLIGHTED_WITH_WARNINGS', 'RUNNING', 'FAILED', 'PARTIAL', 'SUCCEEDED'].includes(batch.status)
}

function shouldReplayHistoryBatch(status: string) {
  return ['FAILED', 'PARTIAL', 'SUCCEEDED'].includes(status)
}

function shouldReplayCurrentRun() {
  return !dryRun.value
}

function historyRunButtonLabel(batch: FeishuImportBatchSummary) {
  if (runningHistoryBatchId.value === batch.batchId) return '导入中'
  if (batch.status === 'RUNNING') return '恢复导入'
  if (['FAILED', 'PARTIAL', 'SUCCEEDED'].includes(batch.status)) return '重新导入'
  return '继续导入'
}

function historyActionLabel(batch: FeishuImportBatchSummary) {
  const labels: Record<string, string> = {
    SUCCEEDED: '已导入',
    REJECTED: '需重新预检',
    CANCELLED: '已取消',
  }
  return labels[batch.status] ?? '不可导入'
}

function historyActionTag(status: string) {
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'REJECTED' || status === 'CANCELLED') return 'warning'
  return 'info'
}

function mappingTag(status: string) {
  if (status === 'READY') return 'success'
  if (status === 'NEEDS_FIELD_MAPPING') return 'warning'
  if (status === 'UNMAPPED_TABLE') return 'danger'
  return 'info'
}

function mappingLabel(status: string) {
  const labels: Record<string, string> = {
    READY: '可进入映射',
    NEEDS_FIELD_MAPPING: '需字段映射',
    UNMAPPED_TABLE: '未识别表',
  }
  return labels[status] ?? status
}

function issueTag(severity: string) {
  if (severity === 'ERROR') return 'danger'
  if (severity === 'WARN') return 'warning'
  return 'info'
}

function issueCategory(issue: FeishuImportIssue) {
  if (issue.issueCategory) return issue.issueCategory
  if (issue.issueType === 'FEISHU_ATTACHMENT_SOURCE_REQUIRED') return 'ATTACHMENT'
  if (issue.issueType === 'FEISHU_FIELD_MAPPING_REQUIRED') return 'FIELD_MAPPING'
  if (issue.issueType === 'FEISHU_TABLE_UNMAPPED') return 'TABLE_MAPPING'
  if (issue.issueType === 'FEISHU_SOURCE_DOCUMENT_NO_MISSING'
    || issue.issueType === 'FEISHU_SOURCE_CREATED_AT_MISSING') return 'DATA_QUALITY'
  if (issue.issueType.startsWith('FEISHU_DUPLICATE_')) return 'DUPLICATE'
  if (issue.issueType === 'FEISHU_REQUIRED_FIELD_MISSING'
    || issue.issueType === 'FEISHU_SHEET_ROW_LIMIT_EXCEEDED') return 'SOURCE_FILE'
  return 'OTHER'
}

function issueBlocking(issue: FeishuImportIssue) {
  if (typeof issue.blocking === 'boolean') return issue.blocking
  return issue.severity === 'ERROR'
    || ['FEISHU_FIELD_MAPPING_REQUIRED', 'FEISHU_TABLE_UNMAPPED',
      'FEISHU_SOURCE_DOCUMENT_NO_MISSING', 'FEISHU_SOURCE_CREATED_AT_MISSING'].includes(issue.issueType)
}

function issueResolutionHint(issue: FeishuImportIssue) {
  return issue.resolutionHint || issue.message || '-'
}

function fallbackRunIssueSummaries(rows: FeishuImportRunRow[]): FeishuImportRunIssueSummary[] {
  const groups = new Map<string, FeishuImportRunIssueSummary>()
  rows.forEach((row) => {
    if (row.projectionStatus === 'PROJECTED' || row.projectionStatus === 'SKIPPED') return
    const status = row.projectionStatus || 'PENDING'
    const message = runIssueMessage(row)
    const category = runIssueCategory(row)
    const key = `${category}|${status}|${row.targetDomain ?? ''}|${row.targetObjectType ?? ''}|${message}`
    const current = groups.get(key)
    if (current) {
      current.rowCount += 1
      return
    }
    groups.set(key, {
      issueCategory: category,
      projectionStatus: status,
      targetDomain: row.targetDomain,
      targetObjectType: row.targetObjectType,
      message,
      rowCount: 1,
    })
  })
  return Array.from(groups.values()).sort((left, right) => right.rowCount - left.rowCount)
}

function runIssueMessage(row: FeishuImportRunRow) {
  const message = row.message?.trim()
  if (!message) return projectionLabel(row.projectionStatus)
  if (message.includes('Order销售订单创建 failed status=400')
    || message.includes('Order销售订单更新 failed status=400')) {
    return 'Order销售订单写入失败，业务字段未通过校验'
  }
  if (message.includes('Order销售回款创建 failed status=400')
    || message.includes('Order销售回款更新 failed status=400')) {
    return 'Order销售回款写入失败，业务字段未通过校验'
  }
  return message.length > 220 ? message.slice(0, 220) : message
}

function runIssueCategory(row: FeishuImportRunRow) {
  const text = `${row.message ?? ''} ${row.targetDomain ?? ''} ${row.targetObjectType ?? ''}`.toLowerCase()
  if (text.includes('attachment') || text.includes('附件') || text.includes('凭证')
    || text.includes('file_token') || text.includes('cos')) return 'ATTACHMENT'
  if (text.includes('商品') || text.includes('规格') || text.includes('单位')
    || text.includes('product') || text.includes('sku')) return 'PRODUCT_MAPPING'
  if (text.includes('客户') || text.includes('门店') || text.includes('商家')
    || text.includes('customer') || row.targetDomain === 'CRM') return 'CUSTOMER_MAPPING'
  if (text.includes('回款') || text.includes('收款') || text.includes('付款')
    || text.includes('payment') || row.targetObjectType === 'PAYMENT_RECORD') return 'PAYMENT_MAPPING'
  if (text.includes('订单明细') || text.includes('order_line')
    || row.targetObjectType === 'SALES_ORDER_LINE') return 'ORDER_LINE'
  if (text.includes('field_mapping') || text.includes('table_mapping') || text.includes('字段映射')) {
    return 'FIELD_MAPPING'
  }
  if (row.projectionStatus === 'FAILED') return 'ORDER_VALIDATION'
  if (row.projectionStatus === 'PENDING' || row.projectionStatus === 'WAITING_MAPPING') return 'DEPENDENCY'
  return 'OTHER'
}

function issueCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    FIELD_MAPPING: '字段映射',
    TABLE_MAPPING: '表识别',
    DATA_QUALITY: '数据质量',
    ATTACHMENT: '附件',
    DUPLICATE: '重复',
    SOURCE_FILE: '源文件',
    CUSTOMER_MAPPING: '客户映射',
    PRODUCT_MAPPING: '商品映射',
    PAYMENT_MAPPING: '回款映射',
    ORDER_LINE: '订单明细',
    ORDER_VALIDATION: '订单校验',
    DEPENDENCY: '依赖未完成',
    OTHER: '其他',
  }
  return labels[category] ?? category
}

function attachmentIssueCount(issues: FeishuImportIssue[]) {
  return issues.filter((issue) => issueCategory(issue) === 'ATTACHMENT').length
}

function runStatusTag(status: string) {
  if (status === 'RUNNING') return 'primary'
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'PARTIAL') return 'warning'
  if (status === 'FAILED') return 'danger'
  return 'info'
}

function runStatusLabel(status: string, dryRunMode = false) {
  if (dryRunMode) {
    const dryRunLabels: Record<string, string> = {
    SUCCEEDED: '试跑通过',
    PARTIAL: '试跑部分通过',
    FAILED: '试跑失败',
    DRY_RUN: '试跑',
    RUNNING: '试跑中',
    }
    return dryRunLabels[status] ?? status
  }
  const labels: Record<string, string> = {
    SUCCEEDED: '正式导入完成',
    RUNNING: '后台导入中',
    PARTIAL: '部分完成',
    FAILED: '失败',
  }
  return labels[status] ?? status
}

function projectionTag(status: string) {
  if (status === 'PROJECTED') return 'success'
  if (status === 'WAITING_MAPPING') return 'warning'
  if (status === 'FAILED') return 'danger'
  return 'info'
}

function projectionLabel(status: string, dryRunMode = false) {
  const labels: Record<string, string> = {
    PROJECTED: '已投影',
    WAITING_MAPPING: '待映射',
    SKIPPED: dryRunMode ? '试跑通过' : '已跳过',
    FAILED: '失败',
    PENDING: '待执行',
  }
  return labels[status] ?? status
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '-'
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${value} B`
}

function formatTime(value: string | null | undefined) {
  if (!value) return '-'
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function errorMessage(reason: unknown, fallback: string) {
  if (typeof reason === 'object' && reason && 'code' in reason) {
    const code = (reason as { code?: unknown }).code
    if (code === 'IAM_FORBIDDEN') {
      return '当前账号缺少飞书导入权限，请先执行 IAM 权限迁移并重新登录'
    }
  }
  if (typeof reason === 'object' && reason && 'message' in reason) {
    const value = (reason as { message?: unknown }).message
    if (typeof value === 'string' && value.trim()) return value
  }
  return fallback
}
</script>

<style scoped>
.feishu-import-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-height: none;
  overflow-x: hidden;
  overflow-y: auto;
  padding-bottom: 88px;
  scroll-padding-top: 16px;
}

.feishu-import-page.supply-page--integration {
  height: 100%;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.import-heading,
.import-workbench,
.flow-strip,
.outcome-panel,
.batch-panel,
.result-panel,
.run-panel,
.issue-panel,
.history-panel,
.headers-panel,
.result-placeholder {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.flow-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
}

.flow-step {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
  gap: 8px;
  color: #475569;
  background: #f8fafc;
  font-size: 14px;
  font-weight: 600;
}

.flow-step--active {
  color: #0f766e;
  background: #ecfdf5;
}

.outcome-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
  border-left-width: 6px;
}

.outcome-panel--idle {
  border-left-color: #94a3b8;
  background: #f8fafc;
}

.outcome-panel--active {
  border-left-color: #2563eb;
  background: #eff6ff;
}

.outcome-panel--success {
  border-left-color: #059669;
  background: #ecfdf5;
}

.outcome-panel--warning {
  border-left-color: #d97706;
  background: #fffbeb;
}

.outcome-panel--danger {
  border-left-color: #dc2626;
  background: #fef2f2;
}

.outcome-copy {
  min-width: 0;
}

.outcome-copy span,
.outcome-state span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.outcome-copy strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
  font-size: 18px;
  line-height: 1.35;
}

.outcome-copy p {
  margin: 6px 0 0;
  color: #475569;
  line-height: 1.6;
}

.outcome-state {
  display: grid;
  justify-items: end;
  gap: 8px;
  flex: 0 0 220px;
  text-align: right;
}

.import-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px;
}

.import-heading h1 {
  margin: 4px 0 8px;
  font-size: 24px;
  line-height: 1.25;
}

.import-heading p,
.headers-card span {
  margin: 0;
  color: #64748b;
}

.eyebrow {
  font-size: 12px;
  font-weight: 700;
  color: #0f766e;
}

.import-workbench {
  display: grid;
  grid-template-columns: minmax(280px, 420px) 1fr;
  gap: 18px;
  padding: 18px;
}

.upload-panel :deep(.el-upload),
.upload-panel :deep(.el-upload-dragger) {
  width: 100%;
}

.upload-icon {
  color: #0f766e;
  font-size: 34px;
}

.upload-text {
  color: #334155;
  font-size: 14px;
  font-weight: 600;
}

.import-actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  min-width: 0;
}

.source-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.source-row :deep(.el-input) {
  flex: 1 1 auto;
  min-width: 0;
}

.source-row :deep(.el-button) {
  flex: 0 0 auto;
}

.selected-file-card {
  display: grid;
  gap: 6px;
  min-height: 96px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  padding: 14px 16px;
  background: #f8fbff;
}

.selected-file-card {
  align-content: center;
}

.result-panel,
.batch-panel,
.run-panel,
.issue-panel,
.history-panel {
  padding: 18px;
}

.result-placeholder {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.placeholder-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(110px, 1fr));
  gap: 12px;
}

.history-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.history-heading > div {
  min-width: 0;
}

.section-actions,
.section-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-actions {
  flex-wrap: wrap;
}

.section-toolbar {
  margin-bottom: 12px;
}

.section-toolbar span {
  display: block;
  margin-bottom: 6px;
  color: #64748b;
  font-size: 12px;
}

.section-toolbar strong {
  color: #0f172a;
  font-size: 15px;
}

.result-summary {
  display: grid;
  grid-template-columns: minmax(220px, 1.6fr) repeat(7, minmax(110px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.notice-alert {
  margin-bottom: 16px;
}

.issue-action-panel {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  padding: 14px;
  background: #f8fbff;
}

.run-issue-panel {
  margin-top: 4px;
}

.issue-action-heading span {
  display: block;
  margin-bottom: 6px;
  color: #64748b;
  font-size: 12px;
}

.issue-action-heading strong {
  color: #0f172a;
  font-size: 15px;
}

.issue-action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.issue-action-item {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 130px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.issue-action-item--danger {
  border-color: #fecaca;
  background: #fff7f7;
}

.issue-action-item--warning {
  border-color: #fed7aa;
  background: #fffaf0;
}

.issue-action-item--info {
  border-color: #bfdbfe;
  background: #f8fbff;
}

.issue-action-item > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.issue-action-item span {
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.issue-action-item strong {
  color: #0f172a;
  font-size: 22px;
  line-height: 1;
}

.issue-action-item p {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
}

.result-summary > div,
.placeholder-grid > div,
.headers-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
}

.selected-file-card span,
.selected-file-card em,
.result-placeholder > div:first-child span,
.placeholder-grid span,
.result-summary span,
.issue-heading span,
.history-heading span {
  display: block;
  margin-bottom: 6px;
  color: #64748b;
  font-size: 12px;
}

.selected-file-card strong,
.result-placeholder > div:first-child strong,
.placeholder-grid strong,
.result-summary strong,
.issue-heading strong,
.history-heading strong {
  color: #0f172a;
  font-size: 15px;
  word-break: break-all;
}

.selected-file-card em {
  font-style: normal;
}

.history-heading em {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  font-style: normal;
}

.run-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.run-options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.result-summary--run {
  grid-template-columns: repeat(6, minmax(110px, 1fr));
}

.table-preview {
  margin-bottom: 16px;
}

.tag-list,
.field-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.headers-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  padding: 12px;
}

.headers-card > div:first-child {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.field-list {
  max-height: 120px;
  overflow: auto;
}

.raw-preview-table {
  margin-top: 12px;
}

.issue-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.muted-text {
  color: #94a3b8;
}

.floating-import-actions {
  position: fixed;
  right: 32px;
  bottom: 88px;
  z-index: 20;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16);
}

@media (max-width: 900px) {
  .import-heading,
  .outcome-panel,
  .source-row,
  .run-actions,
  .section-toolbar,
  .issue-heading,
  .history-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .outcome-state {
    justify-items: start;
    width: 100%;
    text-align: left;
    flex-basis: auto;
  }

  .import-workbench {
    grid-template-columns: 1fr;
  }

  .result-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .floating-import-actions {
    right: 16px;
    bottom: 76px;
  }

  .placeholder-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .flow-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .result-summary {
    grid-template-columns: 1fr;
  }

  .placeholder-grid {
    grid-template-columns: 1fr;
  }
}
</style>
