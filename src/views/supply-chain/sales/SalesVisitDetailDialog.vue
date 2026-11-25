<template>
  <el-dialog
    model-value
    title="拜访详情"
    class="sales-visit-dialog"
    width="min(820px, calc(100vw - 24px))"
    align-center
    append-to-body
    @close="emit('close')"
  >
    <template #header="{ titleId }">
      <h2 :id="titleId" class="dialog-title">拜访详情</h2>
    </template>
    <button v-if="history" class="text-action history-back" @click="history = null">
      ‹ 返回本次拜访
    </button>
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <p v-else-if="!visit" role="status">正在读取拜访记录…</p>
    <template v-if="visit">
      <header class="visit-heading">
        <div class="store-line">
          <h3>{{ visit.store || visit.customer || '门店待关联' }}</h3>
          <el-tag :type="statusTone" effect="light" size="small" round>
            {{ assessmentNames[visit.assessment] || '待核' }}
          </el-tag>
        </div>
        <p class="byline">
          <span
            ><User aria-hidden="true" />{{ visit.name || '业务员待同步'
            }}<template v-if="visit.departmentName"> · {{ visit.departmentName }}</template></span
          >
          <span v-if="regionLabel"><Location aria-hidden="true" />{{ regionLabel }}</span>
          <span
            ><Clock aria-hidden="true" /><time>{{ visit.date }}</time> · 第
            {{ visit.sequence }} 站</span
          >
        </p>
      </header>
      <dl class="visit-summary">
        <div>
          <dt>到店</dt>
          <dd>{{ fieldClock(visit.arrived) }}</dd>
        </div>
        <div>
          <dt>离店</dt>
          <dd>{{ visit.departed ? fieldClock(visit.departed) : '拜访中' }}</dd>
        </div>
        <div>
          <dt>停留</dt>
          <dd>{{ dwell == null ? '—' : dwell }}<small v-if="dwell != null"> 分钟</small></dd>
        </div>
        <div>
          <dt>拜访类型</dt>
          <dd>{{ typeLabel || '—' }}</dd>
        </div>
      </dl>
      <SalesVisitEvidence
        :key="visit.id"
        :visit="toTrackVisit(visit)"
        :employee-name="visit.name"
        :total-millis="
          visit.playbackMillis ??
          (visit.verifiedFiles === visit.files ? visit.verifiedMillis : null)
        "
        :from-fieldwork="fromFieldwork"
        inline
        @capture="history = $event"
        @changed="onChanged"
      >
        <template #content>
          <SalesVisitContent :visit="visit" />
        </template>
        <template #facts>
          <section class="rule-facts">
            <h4>核验依据</h4>
            <dl>
              <dt>核验结论</dt>
              <dd>
                {{ assessmentNames[visit.assessment] || '待核'
                }}<template v-if="reason"> · {{ reason }}</template>
              </dd>
              <dt>停留要求</dt>
              <dd>
                {{ visit.minimumMinutes == null ? '未记录' : visit.minimumMinutes + ' 分钟' }}
              </dd>
              <dt>已核材料</dt>
              <dd>
                门头照 {{ visit.photos }} 张 · 录音 {{ visit.verifiedFiles }} / {{ visit.files }} 个
              </dd>
              <dt>已核录音时长</dt>
              <dd>{{ recordings(visit.files, visit.verifiedFiles, visit.verifiedMillis) }}</dd>
              <dt>适用规则</dt>
              <dd>{{ visit.ruleVersion || '待同步' }}</dd>
              <dt>服务端接收时间</dt>
              <dd>{{ visit.receivedAt ? displayDateTime(visit.receivedAt) : '待同步' }}</dd>
            </dl>
            <h4>拜访信息</h4>
            <dl>
              <dt>计划来源</dt>
              <dd>{{ visit.planId ? '计划内' : '计划外' }}</dd>
              <dt>拜访目的</dt>
              <dd>{{ visit.objective || '未记录' }}</dd>
              <dt>拜访编号</dt>
              <dd>{{ visit.id }}</dd>
            </dl>
          </section>
        </template>
      </SalesVisitEvidence>
    </template>
    <template #footer>
      <el-button
        v-if="
          visit &&
          canMap &&
          (!sameDayMap || (visit.date === props.date && visit.profileId === record?.profileId))
        "
        link
        type="primary"
        :icon="MapLocation"
        @click="emit('map', visit)"
        >查看地图</el-button
      >
      <template v-if="rows && !history && position >= 0">
        <el-button text :disabled="position === 0" :icon="ArrowLeft" @click="move(-1)"
          >上一条</el-button
        >
        <el-button text :disabled="position + 1 >= rows.length" @click="move(1)"
          >下一条<el-icon><ArrowRight /></el-icon
        ></el-button>
      </template>
      <el-button @click="emit('close')">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Clock, Location, MapLocation, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { fieldClock } from '@/api/core/sales-fieldwork'
import type { HistoryCapture } from '@/api/core/sales-fieldwork-evidence'
import {
  assessmentNames,
  readVisitLedger,
  recordings,
  toTrackVisit,
  visitAssessmentReason,
  visitDwellMinutes,
  type ReportVisit,
} from '@/api/core/sales-fieldwork-report'
import { displayDateTime } from '@/utils/business-date'
import SalesVisitEvidence from './SalesVisitEvidence.vue'
import SalesVisitContent from './SalesVisitContent.vue'

const props = defineProps<{
  visitId: string
  date?: string
  record?: ReportVisit
  visitType?: string
  canMap: boolean
  fromFieldwork?: boolean
  sameDayMap?: boolean
  region?: string
  rows?: ReportVisit[]
}>()
const emit = defineEmits<{
  close: []
  map: [row: ReportVisit]
  select: [row: ReportVisit]
  changed: []
}>()
const auth = useAuthStore()
const owner = computed(() =>
  JSON.stringify([auth.user?.id, auth.user?.tenantId, auth.user?.permissions]),
)
watch(owner, () => emit('close'))
const history = ref<HistoryCapture | null>(null)
const id = computed(() => history.value?.visitId || props.visitId)
const date = computed(() => history.value?.businessDate || props.date)
const supplied = computed(() => (props.record?.id === id.value ? props.record : undefined))
const fetched = ref<ReportVisit | null>(null)
const fetchedType = ref('')
const fetchedRegion = ref('')
const regionLabel = computed(() => fetchedRegion.value || (!history.value && props.region))
const position = computed(() => props.rows?.findIndex((row) => row.id === props.visitId) ?? -1)
function move(step: number) {
  const row = props.rows?.[position.value + step]
  if (row) emit('select', row)
}
watch(
  () => props.visitId,
  () => {
    history.value = null
  },
)
const revision = ref(0)
const loadError = ref('')
const visit = computed(() => fetched.value || supplied.value)
const typeLabel = computed(() => fetchedType.value || (!history.value && props.visitType))
const dwell = computed(() => visit.value && visitDwellMinutes(visit.value))
const reason = computed(() => visit.value && visitAssessmentReason(visit.value))
const statusTone = computed(
  () =>
    (
      ({ VALID: 'success', INVALID: 'danger', PENDING: 'warning', IN_PROGRESS: 'primary' }) as const
    )[visit.value?.assessment as 'VALID' | 'INVALID' | 'PENDING' | 'IN_PROGRESS'] || 'info',
)
function onChanged() {
  revision.value++
  emit('changed')
}

watch(
  [id, date, supplied, revision],
  async (_, __, onCleanup) => {
    fetched.value = null
    fetchedType.value = ''
    fetchedRegion.value = ''
    loadError.value = ''
    if (supplied.value && !revision.value) return
    const request = new AbortController()
    onCleanup(() => request.abort())
    try {
      const result = await readVisitLedger(
        { visitId: id.value, from: date.value, to: date.value, size: 1 },
        request.signal,
      )
      if (request.signal.aborted) return
      fetched.value = result.items.find((row) => row.id === id.value) ?? null
      fetchedRegion.value = result.storeRegions?.[id.value] ?? ''
      const counts = result.storeVisitCounts?.[id.value]
      if (counts) fetchedType.value = counts.salespersonVisits === 1 ? '初访' : '回访'
      if (!fetched.value) loadError.value = '当前范围内找不到这条拜访记录'
    } catch (cause) {
      if (!request.signal.aborted)
        loadError.value = cause instanceof Error ? cause.message : '拜访详情读取失败'
    }
  },
  { immediate: true },
)
</script>

<style scoped>
:global(.el-dialog.sales-visit-dialog) {
  --el-dialog-padding-primary: 0;
  display: flex;
  flex-direction: column;
  height: min(720px, calc(100dvh - 32px));
  border-radius: 12px;
  overflow: hidden;
  color: var(--el-text-color-primary);
}
:global(.sales-visit-dialog .el-dialog__header) {
  padding: 16px 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
:global(.sales-visit-dialog .el-dialog__headerbtn) {
  top: 4px;
  right: 8px;
}
:global(.sales-visit-dialog .el-dialog__body) {
  flex: 1;

  min-height: 0;
  padding: 15px 24px 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}
:global(.sales-visit-dialog .el-dialog__footer) {
  display: flex;
  justify-content: flex-end;
  gap: 3px;
  padding: 10px 24px;
  border-top: 1px solid var(--el-border-color-lighter);
}
:global(.sales-visit-dialog .el-dialog__footer .el-button.is-link) {
  margin-right: auto;
}
.dialog-title,
.store-line h3,
.rule-facts h4 {
  margin: 0;
}
.dialog-title {
  font-size: 16px;
  font-weight: 600;
}
.store-line,
.byline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.store-line h3 {
  color: #18324a;
  font-size: 22px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.byline {
  margin: 5px 0 11px;
  font-size: 13px;
  color: #536779;
}
.byline span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.byline svg {
  width: 14px;
  height: 14px;
}
.visit-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 9px 15px;
  border: 1px solid #e4ebf1;
  background: #f4f7fb;
  border-radius: 8px;
}
.visit-summary > div + div {
  border-left: 1px solid #dbe4ec;
  padding-left: 16px;
}
.visit-summary dt,
.rule-facts dt {
  color: #526779;
  font-size: 13px;
}
.visit-summary dd {
  margin: 1px 0 0;
  color: #18324a;
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.visit-summary small {
  font-size: 12px;
  font-weight: 400;
}
.rule-facts h4 {
  font-size: 14px;
}
.rule-facts dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 20px;
  margin: 10px 0 18px;
}
.rule-facts dd {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.history-back {
  padding: 0;
  border: 0;
  margin: 0 0 12px;
  background: none;
  color: var(--el-color-primary);
  cursor: pointer;
}
@media (max-width: 520px) {
  .visit-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  :global(.sales-visit-dialog .el-dialog__body) {
    padding: 16px;
  }
}
</style>
