<template>
  <div class="review-page">
    <div class="review-toolbar">
      <div>
        <strong>待复核拜访</strong>
        <p>只展示已完成离店、尚未形成最终有效性结论的拜访。</p>
      </div>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        :clearable="false"
        @change="resetAndLoad"
      />
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon />

    <el-card shadow="never">
      <el-table v-loading="loading" :data="queue?.items || []" stripe empty-text="当前区间没有待复核拜访">
        <el-table-column label="门店 / 销售" min-width="210" fixed>
          <template #default="scope">
            <div class="primary-cell">
              <strong>{{ scope.row.storeName }}</strong>
              <span>{{ scope.row.salesNo }} · {{ visitTypeLabel(scope.row.visitType) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="到店 / 离店" min-width="190">
          <template #default="scope">
            <div class="time-cell">
              <span>{{ formatDateTime(scope.row.checkedInAt) }}</span>
              <span>{{ formatDateTime(scope.row.checkedOutAt) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="dwellMinutes" label="停留" width="90" sortable>
          <template #default="scope">
            <span :class="{ 'evidence-warning': scope.row.dwellMinutes < scope.row.minimumDwellMinutes }">
              {{ scope.row.dwellMinutes }} / {{ scope.row.minimumDwellMinutes }} 分钟
            </span>
          </template>
        </el-table-column>
        <el-table-column label="录音证据" min-width="150">
          <template #default="scope">
            <span v-if="scope.row.minimumRecordingSeconds <= 0">规则未要求</span>
            <span v-else :class="{ 'evidence-warning': scope.row.uploadedRecordingSeconds < scope.row.minimumRecordingSeconds }">
              {{ formatSeconds(scope.row.uploadedRecordingSeconds) }} / {{ formatSeconds(scope.row.minimumRecordingSeconds) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="拜访结果" min-width="180">
          <template #default="scope">
            <div class="result-cell">
              <strong>{{ contactOutcomeLabel(scope.row.contactOutcome) }}</strong>
              <span v-if="scope.row.contactOutcome === 'CONTACTED'">KP：{{ scope.row.kpName || '未填写' }} · 意向：{{ intentionLabel(scope.row.intentionLevel) }}</span>
              <span v-else>{{ scope.row.resultNote || '未填写现场说明' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="openReview(scope.row)">复核</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <span>共 {{ queue?.total || 0 }} 条</span>
        <el-pagination
          background
          layout="prev, pager, next"
          :current-page="page"
          :page-size="pageSize"
          :total="queue?.total || 0"
          @current-change="changePage"
        />
      </div>
    </el-card>

    <el-alert
      title="复核原则"
      description="完成离店只代表销售已保存现场结果和离店位置，不代表停留或录音已经达标；有效拜访由授权主管结合接触结果、停留、录音和现场说明确认。"
      type="info"
      :closable="false"
      show-icon
    />

    <el-dialog v-model="reviewDialog" title="拜访有效性复核" width="520px" destroy-on-close>
      <div v-if="selectedVisit" class="review-context">
        <strong>{{ selectedVisit.storeName }}</strong>
        <span>{{ selectedVisit.salesNo }} · 停留 {{ selectedVisit.dwellMinutes }}/{{ selectedVisit.minimumDwellMinutes }} 分钟 · 录音 {{ formatSeconds(selectedVisit.uploadedRecordingSeconds) }}/{{ formatSeconds(selectedVisit.minimumRecordingSeconds) }}</span>
        <span>{{ contactOutcomeLabel(selectedVisit.contactOutcome) }}<template v-if="selectedVisit.contactOutcome === 'CONTACTED'"> · KP {{ selectedVisit.kpName || '未填写' }} · {{ intentionLabel(selectedVisit.intentionLevel) }}</template></span>
        <p>{{ selectedVisit.resultNote || '未填写拜访结果说明' }}</p>
      </div>
      <section class="recording-review">
        <div class="recording-review__heading">
          <strong>现场录音证据</strong>
          <span v-if="recordings">{{ recordings.clipCount }} 段 · {{ formatSeconds(Math.round(recordings.uploadedTotalDurationMs / 1000)) }}</span>
        </div>
        <div v-if="recordingsLoading" class="recording-review__state"><el-icon class="is-loading"><Loading /></el-icon> 正在读取录音</div>
        <el-alert v-else-if="recordingsError" :title="recordingsError" type="warning" :closable="false" show-icon />
        <div v-else-if="recordings?.clips.length" class="recording-list">
          <div v-for="clip in recordings.clips" :key="clip.clipId" class="recording-item">
            <div><strong>第 {{ clip.clipIndex + 1 }} 段</strong><span>{{ formatSeconds(Math.round((clip.clientDurationMs || 0) / 1000)) }} · {{ formatBytes(clip.objectSizeBytes) }}</span></div>
            <audio v-if="clipUrls[clip.clipId]" :src="clipUrls[clip.clipId]" controls preload="metadata" />
            <el-button v-else plain :loading="loadingClipId === clip.clipId" @click="loadClip(clip)">授权播放</el-button>
          </div>
        </div>
        <el-empty v-else description="本次拜访没有录音片段" :image-size="64" />
        <small>播放录音需要敏感数据权限，每次读取都会记录审计日志。</small>
      </section>
      <el-form label-position="top">
        <el-form-item label="复核结论" required>
          <el-radio-group v-model="reviewForm.decision" @change="reviewForm.reasonCode = ''">
            <el-radio-button value="EFFECTIVE">确认有效</el-radio-button>
            <el-radio-button value="INEFFECTIVE">确认无效</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="原因" required>
          <el-select v-model="reviewForm.reasonCode" placeholder="请选择标准原因" style="width: 100%">
            <el-option
              v-for="option in reasonOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="复核说明">
          <el-input
            v-model="reviewForm.reviewNote"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="补充证据判断、异常说明或后续要求"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveReview">确认提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { apiClient } from '@/api'

interface VisitReviewQueueItem {
  visitId: string
  salesProfileId: string
  salesNo: string
  storeName: string
  checkedInAt: string
  checkedOutAt: string
  dwellMinutes: number
  minimumDwellMinutes: number
  uploadedRecordingSeconds: number
  minimumRecordingSeconds: number
  contactOutcome: string | null
  kpName: string | null
  intentionLevel: string | null
  resultNote: string | null
  visitType: string
}

interface VisitReviewQueue {
  from: string
  to: string
  items: VisitReviewQueueItem[]
  page: number
  pageSize: number
  total: number
}

interface ManagementRecordingClip {
  clipId: string
  clipIndex: number
  objectSizeBytes: number
  clientDurationMs: number | null
  uploadStatus: string
  createdAt: string
}

interface ManagementRecordingSession {
  visitId: string
  clipCount: number
  uploadedTotalDurationMs: number
  clips: ManagementRecordingClip[]
}

const today = localDate(new Date())
const monthStart = `${today.slice(0, 7)}-01`
const dateRange = ref<[string, string]>([monthStart, today])
const page = ref(1)
const pageSize = 20
const queue = ref<VisitReviewQueue | null>(null)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const reviewDialog = ref(false)
const selectedVisit = ref<VisitReviewQueueItem | null>(null)
const recordings = ref<ManagementRecordingSession | null>(null)
const recordingsLoading = ref(false)
const recordingsError = ref('')
const loadingClipId = ref('')
const clipUrls = ref<Record<string, string>>({})
const reviewForm = reactive({ decision: 'EFFECTIVE', reasonCode: '', reviewNote: '' })

const reasonOptions = computed(() => reviewForm.decision === 'EFFECTIVE'
  ? [
      { value: 'EVIDENCE_CONFIRMED', label: '证据完整，确认有效' },
      { value: 'BUSINESS_RESULT_CONFIRMED', label: '业务结果确认有效' },
    ]
  : [
      { value: 'EVIDENCE_INSUFFICIENT', label: '证据不足' },
      { value: 'RECORDING_INVALID', label: '录音证据无效' },
      { value: 'VISIT_RESULT_INVALID', label: '拜访结果不成立' },
      { value: 'OUT_OF_SCOPE', label: '不属于有效拜访范围' },
      { value: 'OTHER', label: '其他原因' },
    ])

function localDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateTime(value: string): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

function formatSeconds(value: number): string {
  if (value < 60) return `${value} 秒`
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return seconds ? `${minutes}分${seconds}秒` : `${minutes} 分钟`
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function visitTypeLabel(value: string): string {
  return value === 'FIRST_VISIT' ? '首访' : value === 'REVISIT' ? '复访' : '拜访'
}

function intentionLabel(value: string | null): string {
  const labels: Record<string, string> = { HIGH: '高', MEDIUM: '中', LOW: '低', NONE: '无意向' }
  return value ? labels[value] || value : '未填写'
}

function contactOutcomeLabel(value: string | null): string {
  const labels: Record<string, string> = {
    CONTACTED: '已接触 KP', STORE_CLOSED: '门店未营业', KP_ABSENT: 'KP 不在',
    REFUSED: '拒绝接待', OTHER_NO_CONTACT: '其他未接触',
  }
  return value ? labels[value] || value : '未填写接触结果'
}

function errorMessageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return '待复核列表加载失败'
}

async function load() {
  if (!dateRange.value?.[0] || !dateRange.value?.[1]) return
  loading.value = true
  errorMessage.value = ''
  try {
    queue.value = await apiClient.get('/sales/management/review-queue', {
      params: {
        from: dateRange.value[0], to: dateRange.value[1], page: page.value, pageSize,
      },
    }) as VisitReviewQueue
  } catch (error) {
    errorMessage.value = errorMessageOf(error)
  } finally {
    loading.value = false
  }
}

function resetAndLoad() {
  page.value = 1
  void load()
}

function changePage(value: number) {
  page.value = value
  void load()
}

function openReview(item: VisitReviewQueueItem) {
  revokeClipUrls()
  selectedVisit.value = item
  recordings.value = null
  recordingsError.value = ''
  Object.assign(reviewForm, { decision: 'EFFECTIVE', reasonCode: '', reviewNote: '' })
  reviewDialog.value = true
  void loadRecordings(item.visitId)
}

async function loadRecordings(visitId: string) {
  recordingsLoading.value = true
  recordingsError.value = ''
  try {
    recordings.value = await apiClient.get(`/sales/management/visits/${visitId}/recordings`) as ManagementRecordingSession
  } catch (error) {
    recordingsError.value = errorMessageOf(error)
  } finally {
    recordingsLoading.value = false
  }
}

async function loadClip(clip: ManagementRecordingClip) {
  if (!selectedVisit.value) return
  loadingClipId.value = clip.clipId
  try {
    const body = await apiClient.get(
      `/sales/management/visits/${selectedVisit.value.visitId}/recordings/clips/${clip.clipId}`,
      { responseType: 'blob' },
    ) as Blob
    clipUrls.value = { ...clipUrls.value, [clip.clipId]: URL.createObjectURL(body) }
  } catch (error) {
    ElMessage.error(errorMessageOf(error))
  } finally {
    loadingClipId.value = ''
  }
}

function revokeClipUrls() {
  Object.values(clipUrls.value).forEach((url) => URL.revokeObjectURL(url))
  clipUrls.value = {}
}

async function saveReview() {
  if (!selectedVisit.value || !reviewForm.reasonCode) {
    ElMessage.warning('请选择复核原因')
    return
  }
  saving.value = true
  try {
    await apiClient.put(`/sales/management/visits/${selectedVisit.value.visitId}/review`, {
      decision: reviewForm.decision,
      reasonCode: reviewForm.reasonCode,
      reviewNote: reviewForm.reviewNote.trim() || null,
    })
    ElMessage.success('复核结论已保存')
    reviewDialog.value = false
    await load()
  } catch (error) {
    ElMessage.error(errorMessageOf(error))
  } finally {
    saving.value = false
  }
}

onMounted(() => { void load() })
onBeforeUnmount(revokeClipUrls)
watch(reviewDialog, (visible) => { if (!visible) revokeClipUrls() })
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.review-page { display: grid; gap: $spacing-lg; }
.review-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: $spacing-md; padding: $spacing-md; background: $color-bg-white; border: 1px solid $color-border-base; border-radius: $border-radius-lg; }
.review-toolbar > div:first-child { flex: 1; min-width: 240px; }
.review-toolbar strong { color: $color-text-primary; }
.review-toolbar p { margin: 5px 0 0; color: $color-text-secondary; font-size: $font-size-xs; }
.primary-cell, .time-cell, .result-cell { display: flex; flex-direction: column; gap: 5px; }
.primary-cell span, .time-cell, .result-cell { color: $color-text-secondary; font-size: $font-size-xs; }
.evidence-warning { color: $color-danger; font-weight: 600; }
.pagination { display: flex; align-items: center; justify-content: space-between; gap: $spacing-md; margin-top: $spacing-md; color: $color-text-secondary; font-size: $font-size-sm; }
.review-context { display: flex; flex-direction: column; gap: 6px; margin-bottom: $spacing-lg; padding: $spacing-md; background: $color-bg-muted; border-radius: $border-radius-base; }
.review-context span { color: $color-text-secondary; font-size: $font-size-sm; }
.review-context p { margin: 0; color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.6; }
.recording-review { display: grid; gap: $spacing-sm; margin-bottom: $spacing-lg; padding: $spacing-md; border: 1px solid $color-border-base; border-radius: $border-radius-base; }
.recording-review__heading { display: flex; align-items: center; justify-content: space-between; }
.recording-review__heading span, .recording-review > small { color: $color-text-secondary; font-size: $font-size-xs; }
.recording-review__state { color: $color-text-secondary; font-size: $font-size-sm; }
.recording-list { display: grid; gap: $spacing-sm; }
.recording-item { display: grid; grid-template-columns: minmax(110px, .6fr) minmax(190px, 1.4fr); gap: $spacing-sm; align-items: center; padding: 10px; background: $color-bg-muted; border-radius: $border-radius-base; }
.recording-item > div { display: flex; flex-direction: column; gap: 4px; }
.recording-item span { color: $color-text-secondary; font-size: $font-size-xs; }
.recording-item audio { width: 100%; height: 36px; }
@media (max-width: 760px) { .review-toolbar :deep(.el-date-editor) { width: 100%; } .pagination { align-items: flex-start; flex-direction: column; } }
</style>
