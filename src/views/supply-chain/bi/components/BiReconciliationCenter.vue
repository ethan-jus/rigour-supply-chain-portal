<template>
  <section class="reconciliation-center" aria-label="飞书数据对账中心">
    <header>
      <h2>飞书数据对账</h2>
      <el-button
        :icon="Refresh"
        :loading="loadingBatches || loadingSources"
        aria-label="刷新来源批次"
        @click="refreshSources"
        >刷新来源</el-button
      >
    </header>
    <el-select
      v-model="historyId"
      :disabled="busy"
      class="review-history"
      clearable
      placeholder="最近30次复核"
      aria-label="历史复核记录"
      @change="openHistory"
    >
      <el-option
        v-for="item in history"
        :key="item.id"
        :value="item.id"
        :label="`${time(item.capturedAt)} · ${item.fileName} · ${statusName(item.status)}`"
      />
    </el-select>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon role="alert" />
    <el-button v-if="error && historyId" link @click="loadPage(1)">重试读取复核</el-button>
    <el-form label-position="top" class="capture-form" :disabled="busy" @submit.prevent="capture()">
      <el-form-item label="来源方式" class="source-mode">
        <el-radio-group v-model="sourceMode" aria-label="对账来源方式" @change="changeSourceMode">
          <el-radio-button value="FILE">文件版本</el-radio-button>
          <el-radio-button value="ONLINE">在线采集</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="sourceMode === 'ONLINE'" label="飞书来源">
        <el-select
          v-model="onlineSourceId"
          :loading="loadingSources"
          aria-label="在线飞书来源"
          placeholder="选择已绑定的来源"
          filterable
        >
          <el-option
            v-for="source in onlineSources"
            :key="source.id"
            :value="source.id"
            :label="`${source.name}${source.filtered ? '（限定视图）' : ''}`"
          />
        </el-select>
        <p v-if="sourceError" class="source-notice" role="alert">{{ sourceError }}</p>
        <p
          v-else-if="canCaptureOnline && !loadingSources && !onlineSources.length"
          class="source-notice"
          role="status"
        >
          尚未配置本租户的飞书来源绑定，请由管理员核对来源配置及应用授权。
        </p>
      </el-form-item>
      <el-form-item v-else label="来源导出批次">
        <el-select
          v-model="batchId"
          filterable
          placeholder="选择飞书预检文件"
          aria-label="来源导出批次"
        >
          <el-option
            v-for="batch in batches"
            :key="batch.batchId"
            :value="batch.batchId"
            :label="batchLabel(batch)"
            :disabled="batch.status === 'REJECTED'"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="历史版本（可选）">
        <el-select
          v-model="previousBatchId"
          clearable
          filterable
          placeholder="不比较历史版本"
          aria-label="历史版本"
        >
          <el-option
            v-for="batch in previousBatches"
            :key="batch.batchId"
            :value="batch.batchId"
            :label="batchLabel(batch)"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="下单期间（北京时间）">
        <el-date-picker
          v-model="period"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          aria-label="对账下单期间"
        />
      </el-form-item>
      <el-form-item v-if="sourceMode === 'FILE'" label="来源导出时间（北京时间，可选）">
        <el-date-picker
          v-model="exportedAt"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          placeholder="不是文件上传时间"
          aria-label="来源导出时间"
        />
      </el-form-item>
      <div class="capture-actions">
        <el-checkbox v-if="sourceMode === 'FILE'" v-model="complete"
          >确认是所选期间的完整销售订单和明细导出</el-checkbox
        >
        <small v-else>对账不会修改业务订单。</small>
        <div>
          <el-button
            v-if="retryCapture"
            :icon="Refresh"
            :disabled="busy || !sourceReady || !period || !canCaptureOnline"
            @click="capture(true)"
            >重试已采集版本的复核</el-button
          >
          <input
            ref="fileInput"
            hidden
            type="file"
            accept=".xlsx"
            multiple
            aria-label="上传飞书来源Excel"
            @change="upload"
          />
          <el-button
            v-if="sourceMode === 'FILE'"
            :icon="Upload"
            :loading="uploading"
            :disabled="busy"
            @click="fileInput?.click()"
            >上传对账文件</el-button
          >
          <el-button
            type="primary"
            :icon="Connection"
            :loading="busy"
            :disabled="
              !sourceReady ||
              !period ||
              uploading ||
              !canCapture ||
              (sourceMode === 'ONLINE' && !canCaptureOnline)
            "
            @click="capture()"
            >{{
              busy
                ? capturePhase === 'SOURCE'
                  ? '采集飞书中'
                  : '正在复核'
                : sourceMode === 'ONLINE'
                  ? '采集并复核'
                  : '生成复核'
            }}</el-button
          >
        </div>
        <small v-if="!canCapture" role="status"
          >当前账号仅可查看复核记录；生成复核需管理员授予相应权限。</small
        >
        <small v-if="retryCapture" role="status">
          飞书版本已保存（{{ time(retryCapture.completedAt) }}），{{
            busy ? '正在复核。' : '复核结果尚未确认，可先刷新复核记录查看。'
          }}
        </small>
        <small v-else-if="sourceMode === 'ONLINE' && !canCaptureOnline" role="status"
          >在线采集还需要飞书来源读取权限。</small
        >
      </div>
    </el-form>

    <template v-if="result">
      <div class="evidence-band">
        <span>复核来源：{{ result.sourceVersion.fileName }}</span>
        <span>下单期间 {{ time(result.from) }} 至 {{ time(result.to) }}</span>
        <span :class="`status-${result.status.toLowerCase()}`">{{
          statusName(result.status)
        }}</span>
        <span>核对时间 {{ time(result.completedAt) }}</span>
        <el-button link :icon="InfoFilled" @click="methodVisible = true">来源与口径</el-button>
      </div>
      <dl class="review-summary">
        <div>
          <dt>复核范围订单（笔）</dt>
          <dd>{{ result.summary.count }}</dd>
        </div>
        <div>
          <dt>综合一致订单（笔）</dt>
          <dd>{{ result.summary.matched }}</dd>
        </div>
        <div>
          <dt>存在差异订单（笔）</dt>
          <dd>{{ result.summary.differences }}</dd>
        </div>
        <div>
          <dt>待核验订单（笔）</dt>
          <dd>{{ result.summary.unverified }}</dd>
        </div>
        <div>
          <dt>退款排除订单（笔）</dt>
          <dd>{{ result.summary.excluded }}</dd>
        </div>
      </dl>
      <div class="comparison-totals" role="table" aria-label="订单金额核对">
        <div role="row">
          <strong role="columnheader">复核范围订单金额</strong
          ><strong role="columnheader">飞书</strong><strong role="columnheader">业务订单</strong
          ><strong role="columnheader">看板</strong>
        </div>
        <div role="row">
          <span>应收金额（元）</span><span>{{ money(result.summary.sourceAmount) }}</span
          ><span>{{ money(result.summary.businessAmount) }}</span
          ><span>{{ money(result.summary.biAmount) }}</span>
        </div>
        <div role="row">
          <span>累计回款（元）</span><span>{{ money(result.summary.sourcePaid) }}</span
          ><span>{{ money(result.summary.businessPaid) }}</span
          ><span>{{ money(result.summary.biPaid) }}</span>
        </div>
      </div>
      <div class="detail-controls">
        <el-radio-group v-model="kind" aria-label="对账粒度" @change="loadPage(1)"
          ><el-radio-button value="ORDER">订单</el-radio-button
          ><el-radio-button value="SKU">商品 / SKU</el-radio-button></el-radio-group
        >
        <el-select
          v-model="city"
          clearable
          placeholder="全部城市"
          aria-label="对账城市"
          @change="loadPage(1)"
          ><el-option
            v-for="item in result.cities"
            :key="item.name"
            :value="item.name"
            :label="`${item.name} · ${item.summary.differences}笔订单有差异`"
        /></el-select>
        <el-select
          v-model="sales"
          clearable
          placeholder="全部销售"
          aria-label="对账销售"
          @change="loadPage(1)"
          ><el-option
            v-for="item in result.sales"
            :key="item.name"
            :value="item.name"
            :label="`${item.name} · ${item.summary.differences}笔订单有差异`"
        /></el-select>
        <el-select
          v-model="status"
          clearable
          placeholder="全部综合结论"
          aria-label="对账结论"
          @change="loadPage(1)"
          ><el-option v-for="item in statuses" :key="item" :value="item" :label="statusName(item)"
        /></el-select>
        <el-input
          v-model="keyword"
          clearable
          placeholder="来源订单、客户、商品"
          aria-label="搜索对账明细"
          @keyup.enter="loadPage(1)"
          @clear="loadPage(1)"
        />
        <el-button :icon="Search" aria-label="查询对账明细" @click="loadPage(1)" />
      </div>
      <div v-if="orderNo" class="order-scope">
        订单 {{ orderNo }} <el-button link @click="clearOrder">返回全部订单</el-button>
      </div>
      <div class="detail-summary">
        <span role="status"
          >当前筛选：{{ result.total }}
          {{ displayedKind === 'ORDER' ? '笔订单' : '个 SKU 比较组' }}</span
        >
        <el-button
          :icon="Download"
          :loading="exporting"
          :disabled="busy || loadingRows || exporting"
          @click="exportExcel"
        >
          导出当前筛选 Excel
        </el-button>
      </div>
      <p v-if="hasUnevaluatedDimensions" class="review-notice" role="status">
        历史记录未分项核验，请重新对账。
      </p>
      <el-table
        v-loading="loadingRows"
        :data="result.rows"
        row-key="key"
        empty-text="当前筛选没有复核记录"
        class="review-table"
      >
        <el-table-column prop="orderNo" label="来源订单" min-width="155"
          ><template #default="{ row }"
            ><el-button v-if="row.orderNo" link @click="inspectOrder(row as ReconciliationRow)">{{
              row.orderNo
            }}</el-button
            ><span v-else>关联待核验</span></template
          ></el-table-column
        >
        <el-table-column prop="city" label="城市" width="100" />
        <el-table-column prop="sales" label="责任销售" width="110" />
        <el-table-column label="客户 / 商品" min-width="190"
          ><template #default="{ row }">{{
            displayFact(row as ReconciliationRow)?.[
              row.kind === 'ORDER' ? 'customer' : 'product'
            ] || '未关联'
          }}</template></el-table-column
        >
        <el-table-column label="来源金额（元）" align="right" min-width="140"
          ><template #default="{ row }">{{ money(row.source?.amount) }}</template></el-table-column
        >
        <el-table-column label="业务金额（元）" align="right" min-width="140"
          ><template #default="{ row }">{{
            money(row.business?.amount)
          }}</template></el-table-column
        >
        <el-table-column label="BI金额（元）" align="right" min-width="140"
          ><template #default="{ row }">{{ money(row.bi?.amount) }}</template></el-table-column
        >
        <el-table-column
          v-for="dimension in reconciliationDimensions"
          :key="dimension.key"
          :label="dimension.label"
          min-width="150"
        >
          <template #default="{ row }">
            <span :class="`status-${(row[dimension.key] || 'UNVERIFIED').toLowerCase()}`">{{
              statusName(row[dimension.key])
            }}</span>
          </template>
        </el-table-column>
        <el-table-column label="核对详情" width="125"
          ><template #default="{ row }"
            ><el-button
              link
              :class="`status-${row.status.toLowerCase()}`"
              @click="selectedRow = row as ReconciliationRow"
              >查看明细</el-button
            >
          </template></el-table-column
        >
        <el-table-column v-if="canReadOrders" label="订单核查" fixed="right" width="120">
          <template #default="{ row }">
            <el-button
              v-if="row.orderNo"
              link
              :icon="View"
              @click="openBusinessOrder(row as ReconciliationRow)"
              >查看订单</el-button
            >
            <span v-else>关联待核验</span>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        :current-page="result.page"
        :page-size="result.pageSize"
        :total="result.total"
        :disabled="loadingRows || busy"
        layout="prev, pager, next"
        @current-change="loadPage"
      />
    </template>
    <el-empty v-else-if="!loadingBatches" description="尚未生成复核记录" />

    <el-dialog v-model="methodVisible" title="来源与比较口径" width="min(800px, 94vw)">
      <template v-if="result">
        <dl class="source-details">
          <dt>本次来源</dt>
          <dd>{{ result.sourceVersion.fileName }}</dd>
          <dt>{{ result.sourceVersion.onlineEvidence ? '来源采集完成' : '文件上传时间' }}</dt>
          <dd>{{ time(result.sourceVersion.uploadedAt) }}</dd>
          <template v-if="result.sourceVersion.onlineEvidence">
            <dt>在线采集窗口</dt>
            <dd>
              {{ time(result.sourceVersion.onlineEvidence.startedAt) }} 至
              {{ time(result.sourceVersion.onlineEvidence.completedAt) }}
            </dd>
            <dt>来源范围</dt>
            <dd>
              {{
                result.sourceVersion.onlineEvidence.filtered
                  ? '限定视图，不作为完整来源缺失依据'
                  : '绑定的订单与明细表'
              }}
            </dd>
            <dt>采集证据</dt>
            <dd>
              {{ result.sourceVersion.onlineEvidence.pageCount }} 页 ·
              {{ result.sourceVersion.onlineEvidence.recordCount }} 条 ·
              {{ result.sourceVersion.onlineEvidence.complete ? '分页完整' : '分页未完整' }}
            </dd>
          </template>
          <template v-else
            ><dt>人工声明导出时间</dt>
            <dd>{{ time(result.sourceExportedAt) }}</dd></template
          >
          <dt>历史来源</dt>
          <dd>{{ result.previousVersion?.fileName || '未选择' }}</dd>
        </dl>
        <p>{{ onlineStatusText }}</p>
        <p v-for="notice in result.notices" :key="notice">{{ notice }}</p>
      </template>
    </el-dialog>
    <el-dialog
      :model-value="!!selectedRow"
      title="对账明细"
      width="min(1100px, 96vw)"
      @close="selectedRow = null"
    >
      <template v-if="selectedRow">
        <p>
          订单 {{ selectedRow.orderNo || '待关联' }} · {{ versionName(selectedRow.versionStatus) }}
        </p>
        <div class="dimension-statuses">
          <span
            v-for="dimension in reconciliationDimensions"
            :key="dimension.key"
            :class="`status-${(selectedRow[dimension.key] || 'UNVERIFIED').toLowerCase()}`"
          >
            {{ dimension.label }}：{{ statusName(selectedRow[dimension.key]) }}
          </span>
          <el-button
            v-if="canReadOrders && selectedRow.orderNo"
            link
            :icon="View"
            @click="openBusinessOrder(selectedRow)"
            >查看订单</el-button
          >
        </div>
        <p v-for="issue in reconciliationWarnings(selectedRow)" :key="issue" class="review-notice">
          {{ issue }}
        </p>
        <el-table :data="fieldRows(selectedRow)">
          <el-table-column prop="label" label="业务字段" width="140" />
          <el-table-column prop="previous" label="历史来源" min-width="180" />
          <el-table-column prop="source" label="所选来源" min-width="180" />
          <el-table-column prop="business" label="业务系统" min-width="180" />
          <el-table-column prop="bi" label="看板" min-width="180" />
        </el-table>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import {
  Connection,
  Download,
  InfoFilled,
  Refresh,
  Search,
  Upload,
  View,
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  getFeishuImportBatches,
  preflightFeishuImportBundleFiles,
  type FeishuImportBatchSummary,
} from '@/api/core/feishu-import'
import {
  captureReconciliationReview,
  getReconciliationReview,
  getReconciliationHistory,
  getOnlineReconciliationSources,
  captureOnlineReconciliationSource,
  type OnlineReconciliationSource,
  type ReconciliationHistory,
  type ReconciliationFact,
  type ReconciliationPage,
  type ReconciliationRow,
  type ReconciliationQuery,
} from '@/api/core/bi-reconciliation-review'
import { reportQuantityText } from '../report-format'
import {
  associationEvidenceName,
  factWarnings,
  originalUnit,
  reconciliationDimensions,
  reconciliationMoney as money,
  reconciliationStatusName as statusName,
  reconciliationWarnings,
  unitEvidenceName,
} from '../reconciliation-display'
import { buildReconciliationExcel, readReconciliationExport } from '../reconciliation-export'
import { biErrorMessage } from '../bi-error'
import { useAuthStore } from '@/stores/auth'
import { businessDate, businessDateRange, businessPeriodRange } from '@/utils/business-date'

const props = defineProps<{ from?: string; to?: string }>()
const auth = useAuthStore()
const router = useRouter()
const canReadOrders = computed(() => auth.hasPermission('order:read'))
const canCapture = computed(() => auth.hasPermission('analytics:reconciliation:write'))
const canCaptureOnline = computed(
  () =>
    canCapture.value &&
    (auth.hasPermission('integration:feishu:import') ||
      auth.hasPermission('integration:feishu:write')),
)
const sourceMode = ref<'FILE' | 'ONLINE'>('FILE')
const onlineSources = ref<OnlineReconciliationSource[]>([])
const onlineSourceId = ref('')
const loadingSources = ref(false)
const sourceError = ref('')
const capturePhase = ref<'SOURCE' | 'REVIEW'>('REVIEW')
const savedCapture = ref<{ id: string; sourceId: string; completedAt: string } | null>(null)
const retryCapture = computed(() =>
  sourceMode.value === 'ONLINE' && savedCapture.value?.sourceId === onlineSourceId.value
    ? savedCapture.value
    : null,
)
const sourceReady = computed(() =>
  sourceMode.value === 'FILE'
    ? !!batchId.value
    : !loadingSources.value &&
      !sourceError.value &&
      onlineSources.value.some((source) => source.id === onlineSourceId.value),
)
const batches = ref<FeishuImportBatchSummary[]>([])
const batchId = ref('')
const previousBatchId = ref('')
const defaultPeriod = businessPeriodRange('year')
const period = ref<[string, string] | null>([
  props.from ? businessDate(props.from) : defaultPeriod[0],
  props.to ? businessDate(props.to) : defaultPeriod[1],
])
const exportedAt = ref<string | null>(null)
const complete = ref(false)
const result = ref<ReconciliationPage | null>(null)
const history = ref<ReconciliationHistory[]>([])
const historyId = ref('')
const selectedRow = ref<ReconciliationRow | null>(null)
const methodVisible = ref(false)
const loadingBatches = ref(false)
const busy = ref(false)
const uploading = ref(false)
const loadingRows = ref(false)
const exporting = ref(false)
const loadedQuery = ref<ReconciliationQuery>({ kind: 'ORDER', page: 1, pageSize: 50 })
const displayedKind = computed(() => loadedQuery.value.kind)
const hasUnevaluatedDimensions = computed(() =>
  result.value?.rows.some((row) => reconciliationDimensions.some(({ key }) => !row[key])),
)
const error = ref('')
const fileInput = ref<HTMLInputElement>()
const kind = ref<'ORDER' | 'SKU'>('ORDER')
const status = ref('')
const city = ref('')
const sales = ref('')
const orderNo = ref('')
const keyword = ref('')
let rowRequest = 0
let disposed = false
const statuses = ['DIFF', 'UNVERIFIED', 'STALE', 'EXCLUDED_REFUND', 'SNAPSHOT_MATCH']
const previousBatches = computed(() =>
  batches.value.filter(
    (batch) =>
      batch.batchId !== batchId.value &&
      (sourceMode.value === 'ONLINE' ||
        batch.createdAt <
          (batches.value.find((value) => value.batchId === batchId.value)?.createdAt || '')),
  ),
)
const versionName = (value: string) =>
  ({
    NOT_COMPARED: '未比较历史',
    ADDED: '本次新增',
    ABSENT_IN_SELECTED_VERSION: '本次未出现',
    UNCHANGED: '无变化',
    CHANGED: '字段有变化',
  })[value] || '待核验'
const time = (value?: string | null) => (value ? displayDateTime(value) : '未提供')
const onlineStatusText = computed(() =>
  result.value?.sourceVersion.onlineEvidence
    ? '在线版本已采集，非实时一致性保证'
    : '当前在线：未验证',
)
const batchLabel = (batch: FeishuImportBatchSummary) =>
  `${time(batch.createdAt)} · ${batch.originalFileName}`
const displayFact = (row: ReconciliationRow) => row.source || row.business || row.bi || row.previous
const fail = (reason: unknown) => biErrorMessage(reason, '对账请求失败，请检查服务和权限后重试')

async function loadBatches() {
  loadingBatches.value = true
  error.value = ''
  try {
    const data = await getFeishuImportBatches(100)
    if (!disposed) batches.value = data
  } catch (reason) {
    if (!disposed) error.value = fail(reason)
  } finally {
    if (!disposed) loadingBatches.value = false
  }
}
async function loadOnlineSources() {
  if (!canCaptureOnline.value || loadingSources.value) return
  loadingSources.value = true
  sourceError.value = ''
  try {
    const data = await getOnlineReconciliationSources()
    if (disposed) return
    onlineSources.value = data
    if (!data.some((source) => source.id === onlineSourceId.value)) onlineSourceId.value = ''
  } catch (reason) {
    if (!disposed) {
      onlineSources.value = []
      onlineSourceId.value = ''
      sourceError.value = fail(reason)
    }
  } finally {
    if (!disposed) loadingSources.value = false
  }
}
function changeSourceMode() {
  previousBatchId.value = ''
  if (sourceMode.value === 'ONLINE') void loadOnlineSources()
}
function refreshSources() {
  if (sourceMode.value === 'ONLINE') void loadOnlineSources()
  else void loadBatches()
}
async function loadHistory() {
  try {
    const data = await getReconciliationHistory()
    if (!disposed) history.value = data
  } catch (reason) {
    if (!disposed) error.value = fail(reason)
  }
}
async function openHistory(id: string) {
  ++rowRequest
  result.value = null
  selectedRow.value = null
  kind.value = 'ORDER'
  status.value = ''
  city.value = ''
  sales.value = ''
  orderNo.value = ''
  keyword.value = ''
  if (id) await loadPage(1)
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  uploading.value = true
  error.value = ''
  try {
    const uploaded = await preflightFeishuImportBundleFiles(files)
    if (disposed) return
    await loadBatches()
    batchId.value = uploaded.batchId
    complete.value = false
    if (uploaded.status === 'REJECTED')
      error.value = '文件预检未通过，请在飞书导入页面查看预检问题；未执行导入'
  } catch (reason) {
    if (!disposed) error.value = fail(reason)
  } finally {
    if (!disposed) uploading.value = false
    input.value = ''
  }
}
async function capture(retry = false) {
  if (
    !period.value ||
    !sourceReady.value ||
    busy.value ||
    !canCapture.value ||
    (sourceMode.value === 'ONLINE' && !canCaptureOnline.value) ||
    (retry && !retryCapture.value)
  )
    return
  ++rowRequest
  busy.value = true
  error.value = ''
  result.value = null
  selectedRow.value = null
  try {
    const range = businessDateRange(period.value[0], period.value[1])
    let onlineCaptureId: string | undefined
    if (sourceMode.value === 'ONLINE') {
      if (retry) {
        onlineCaptureId = retryCapture.value!.id
      } else {
        savedCapture.value = null
        capturePhase.value = 'SOURCE'
        const captured = await captureOnlineReconciliationSource(onlineSourceId.value)
        if (disposed) return
        if (!captured.complete) throw new Error('飞书分页未完整，本次未生成复核')
        savedCapture.value = {
          id: captured.id,
          sourceId: onlineSourceId.value,
          completedAt: captured.completedAt,
        }
        onlineCaptureId = captured.id
      }
    }
    capturePhase.value = 'REVIEW'
    const data = await captureReconciliationReview({
      batchId: sourceMode.value === 'FILE' ? batchId.value : undefined,
      onlineCaptureId,
      previousBatchId: previousBatchId.value || undefined,
      from: range.from,
      to: range.to,
      sourceDeclaredComplete: sourceMode.value === 'FILE' && complete.value,
      sourceExportedAt:
        sourceMode.value === 'FILE' && exportedAt.value ? `${exportedAt.value}+08:00` : undefined,
    })
    if (disposed) return
    kind.value = 'ORDER'
    status.value = ''
    city.value = ''
    sales.value = ''
    orderNo.value = ''
    keyword.value = ''
    result.value = data
    loadedQuery.value = { kind: 'ORDER', page: 1, pageSize: 50 }
    savedCapture.value = null
    historyId.value = data.id
    await loadHistory()
  } catch (reason) {
    if (!disposed) error.value = fail(reason)
  } finally {
    if (!disposed) busy.value = false
  }
}
async function loadPage(page = 1) {
  if (!historyId.value || busy.value) return
  const request = ++rowRequest
  loadingRows.value = true
  error.value = ''
  const query: ReconciliationQuery = {
    kind: kind.value,
    status: status.value || undefined,
    city: city.value || undefined,
    sales: sales.value || undefined,
    orderNo: orderNo.value || undefined,
    keyword: keyword.value || undefined,
    page,
    pageSize: 50,
  }
  try {
    const data = await getReconciliationReview(historyId.value, query)
    if (!disposed && request === rowRequest) {
      result.value = data
      loadedQuery.value = query
    }
  } catch (reason) {
    if (!disposed && request === rowRequest) {
      error.value = fail(reason)
      result.value = null
    }
  } finally {
    if (!disposed && request === rowRequest) loadingRows.value = false
  }
}
function inspectOrder(row: ReconciliationRow) {
  if (row.kind === 'SKU') {
    selectedRow.value = row
    return
  }
  orderNo.value = row.orderNo || ''
  kind.value = 'SKU'
  status.value = ''
  void loadPage(1)
}
function openBusinessOrder(row: ReconciliationRow) {
  if (!row.orderNo || !canReadOrders.value) return
  const version = result.value?.sourceVersion
  const online = version?.onlineEvidence
  const namespace = online?.sourceId || version?.batchId
  const capture = online ? online.captureId : version?.batchId
  void router.push({
    name: 'SupplyOrderSalesOrders',
    query: {
      sourceOrderNo: row.orderNo,
      ...(row.kind === 'SKU' && row.source && namespace && capture
        ? {
            repairSourceNamespace: namespace,
            repairSourceCaptureRef: capture,
            repairLineId: row.business?.systemLineId || undefined,
            repairSourceProductRecordId: row.source.sourceProductId || undefined,
            repairSourceProductCode: row.source.sourceProductCode || undefined,
          }
        : {}),
    },
  })
}
async function exportExcel() {
  if (!result.value || loadingRows.value || busy.value || exporting.value) return
  const snapshot = result.value
  const query = { ...loadedQuery.value }
  exporting.value = true
  error.value = ''
  try {
    const completeReview = await readReconciliationExport(snapshot, query)
    if (disposed) return
    const output = await buildReconciliationExcel(completeReview, query)
    if (disposed) return
    const url = URL.createObjectURL(
      new Blob([output.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = output.filename
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (reason) {
    if (!disposed) error.value = biErrorMessage(reason, '复核导出失败，请重试')
  } finally {
    if (!disposed) exporting.value = false
  }
}
function clearOrder() {
  orderNo.value = ''
  kind.value = 'ORDER'
  void loadPage(1)
}
function fieldRows(row: ReconciliationRow) {
  const fields: [keyof ReconciliationFact, string, 'money' | 'quantity' | 'date' | 'text'][] = [
    ['amount', row.kind === 'ORDER' ? '应收金额（元）' : '商品组金额（元）', 'money'],
    ...(row.kind === 'ORDER'
      ? ([
          ['paid', '累计回款（元）', 'money'],
          ['unpaid', '待回款（元）', 'money'],
        ] as [keyof ReconciliationFact, string, 'money'][])
      : []),
    ['quantity', '原单位数量', 'quantity'],
    ['unit', '核对单位', 'text'],
    ['rawUnit', '来源原单位标记', 'text'],
    ['unitEvidence', '单位依据', 'text'],
    ['associationEvidence', '商品关联依据', 'text'],
    ['product', '商品', 'text'],
    ['specification', '规格', 'text'],
    ['city', '城市', 'text'],
    ['sales', '责任销售', 'text'],
    ['customer', '客户', 'text'],
    ['orderDate', '业务日期', 'date'],
    ['updatedAt', '更新时间', 'date'],
  ]
  const rows = fields.map(([field, label, format]) => {
    const get = (fact: ReconciliationFact | null) => {
      if (field === 'rawUnit') return originalUnit(fact)
      if (fact && field === 'unitEvidence') return unitEvidenceName(fact.unitEvidence)
      if (fact && field === 'associationEvidence')
        return associationEvidenceName(fact.associationEvidence)
      const value = fact?.[field]
      if (value == null) return '未提供'
      return format === 'money'
        ? money(value)
        : format === 'quantity'
          ? reportQuantityText(value)
          : format === 'date'
            ? time(String(value))
            : String(value)
    }
    return {
      label,
      previous: get(row.previous),
      source: get(row.source),
      business: get(row.business),
      bi: get(row.bi),
    }
  })
  rows.push({
    label: '证据提醒',
    previous: factWarnings(row.previous).join('；') || '未提供',
    source: factWarnings(row.source).join('；') || '未提供',
    business: factWarnings(row.business).join('；') || '未提供',
    bi: factWarnings(row.bi).join('；') || '未提供',
  })
  return rows
}
onMounted(() => {
  void loadBatches()
  void loadHistory()
})
onBeforeUnmount(() => {
  disposed = true
  ++rowRequest
})
</script>

<style scoped>
.reconciliation-center {
  min-width: 0;
  background: #fff;
  padding: 18px 20px;
  color: #263648;
}
header,
.capture-actions,
.capture-actions > div,
.evidence-band,
.detail-summary,
.dimension-statuses,
.detail-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.detail-summary {
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 13px;
}
.review-notice,
.fact-evidence {
  color: #735118;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.review-notice {
  margin: 5px 0;
}
header {
  justify-content: space-between;
  margin-bottom: 16px;
}
h2 {
  margin: 0;
  font-size: 18px;
}
.review-history {
  width: min(100%, 640px);
  margin-bottom: 12px;
}
.capture-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
  padding: 14px 0;
  border-bottom: 1px solid #dce3eb;
}
.source-mode {
  grid-column: 1 / -1;
}
.source-notice {
  margin: 6px 0 0;
  color: #735118;
  font-size: 13px;
}
.capture-form :deep(.el-form-item),
.capture-form :deep(.el-date-editor),
.capture-form :deep(.el-select) {
  width: 100%;
  min-width: 0;
}
.capture-actions {
  grid-column: 1 / -1;
  justify-content: space-between;
}
.capture-actions :deep(.el-checkbox) {
  height: auto;
  white-space: normal;
}
.evidence-band {
  font-size: 12px;
  padding: 12px 0;
}
.review-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 0;
  padding: 12px 0 20px;
}
.review-summary dt {
  font-size: 13px;
  color: #58677a;
}
.review-summary dd {
  margin: 8px 0 0;
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}
.comparison-totals {
  border-top: 1px solid #dce3eb;
  border-bottom: 1px solid #dce3eb;
  font-size: 13px;
  overflow: auto;
}
.comparison-totals > div {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  padding: 10px 0;
  min-width: 540px;
}
.comparison-totals span,
.comparison-totals strong {
  padding: 0 10px;
  font-variant-numeric: tabular-nums;
}
.detail-controls {
  padding: 18px 0;
}
.detail-controls :deep(.el-select),
.detail-controls :deep(.el-input) {
  width: 170px;
}
.detail-controls :deep(.el-select .el-input) {
  width: 100%;
}
.review-table {
  max-width: 100%;
}
.el-pagination {
  padding-top: 14px;
  overflow: auto;
}
.order-scope {
  margin: 4px 0 12px;
  font-size: 13px;
}
.status-diff {
  color: #c0392b;
}
.status-unverified,
.status-stale {
  color: #956019;
}
.status-snapshot_match {
  color: #13745b;
}
.status-excluded_refund {
  color: #526170;
}
.status-not_applicable {
  color: #526170;
}
.source-trace {
  margin-top: 16px;
}
.source-details {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 10px;
}
.source-details dd {
  margin: 0;
  overflow-wrap: anywhere;
}
:deep(button:focus-visible) {
  outline: 2px solid #2864e8;
  outline-offset: 2px;
}
@media (max-width: 700px) {
  .reconciliation-center {
    padding: 12px;
  }
  .capture-form {
    grid-template-columns: minmax(0, 1fr);
  }
  .review-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .detail-controls :deep(.el-select),
  .detail-controls :deep(.el-input) {
    width: 100%;
  }
  .source-details {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
