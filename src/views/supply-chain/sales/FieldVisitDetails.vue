<template>
  <el-drawer
    :model-value="!!visit"
    class="field-visit-drawer"
    size="min(510px, 96vw)"
    :show-close="false"
    destroy-on-close
    @close="$emit('close')"
  >
    <template #header="{ close, titleId }">
      <div v-if="visit" class="visit-heading">
        <div>
          <small>拜访记录 / {{ visit.id }}</small>
          <h2 :id="titleId">
            第 {{ visit.sequence }} 次 · {{ visit.store || visit.customer || '门店待关联' }}
          </h2>
        </div>
        <el-button size="small" @click="close">关闭</el-button>
      </div>
    </template>
    <div v-if="visit" class="visit-detail">
      <p class="visit-identity">
        <span>{{ visit.name }}</span>
        <span v-if="organization">{{ organization }}</span>
        <span>{{ visit.date }}</span>
      </p>
      <dl class="visit-times">
        <div>
          <dt>到店</dt>
          <dd>{{ fieldClock(visit.arrived) }}</dd>
        </div>
        <div>
          <dt>离店</dt>
          <dd>{{ visit.departed ? fieldClock(visit.departed) : '进行中' }}</dd>
        </div>
        <div>
          <dt>已知停留</dt>
          <dd>{{ dwell === null ? '—' : dwell + ' 分钟' }}</dd>
        </div>
      </dl>
      <dl class="visit-facts">
        <dt>来源</dt>
        <dd>{{ visit.planId ? '计划内拜访' : '计划外拜访' }}</dd>
        <dt>拜访目的</dt>
        <dd>{{ visit.objective || '未记录' }}</dd>
        <dt>现场结果</dt>
        <dd>{{ visit.result || '未记录' }}</dd>
        <dt>服务端收到到离店记录</dt>
        <dd :title="displayDateTime(visit.receivedAt)">{{ fieldClock(visit.receivedAt) }}</dd>
      </dl>

      <section class="visit-recordings" aria-labelledby="visit-recordings-title">
        <h3 id="visit-recordings-title">录音 · {{ visit.files }} 个文件</h3>
        <p v-if="recordingError" role="alert" class="visit-muted">{{ recordingError }}</p>
        <p v-else-if="loadingRecordings" class="visit-muted" role="status">正在读取录音片段</p>
        <table v-else-if="clips.length">
          <thead>
            <tr>
              <th scope="col">文件</th>
              <th scope="col">接收状态</th>
              <th scope="col">核验时长</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(clip, index) in clips" :key="clip.clipId">
              <td>片段 {{ String(index + 1).padStart(2, '0') }}</td>
              <td>
                <span class="clip-status" :class="{ verified: clip.verifyStatus === 'VERIFIED' }">{{
                  clip.verifyStatus === 'VERIFIED' ? '已核' : '已收 · 待核'
                }}</span>
              </td>
              <td>
                {{
                  clip.verifyStatus === 'VERIFIED' && clip.verifiedDurationMs != null
                    ? recordings(1, 1, clip.verifiedDurationMs)
                    : '—'
                }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="visit.files && !canAudio" class="visit-muted">当前权限可查看录音汇总。</p>
        <p v-else-if="visit.files" class="visit-muted">暂无可查看的录音片段。</p>
        <p class="visit-muted">
          已核总时长 {{ recordings(visit.files, visit.verifiedFiles, visit.verifiedMillis) }}
          <template v-if="visit.files > visit.verifiedFiles">
            · {{ visit.files - visit.verifiedFiles }} 个文件待核</template
          >
        </p>
      </section>

      <section aria-labelledby="visit-rule-title">
        <h3 id="visit-rule-title">当次规则核对</h3>
        <dl class="visit-facts">
          <dt>核验结论</dt>
          <dd>
            <span class="assessment-status" :data-status="visit.assessment">{{
              assessmentNames[visit.assessment] || '待核'
            }}</span>
          </dd>
          <dt>现场停留</dt>
          <dd>
            {{ dwell === null ? '—' : dwell + ' 分钟' }}
            <template v-if="visit.minimumMinutes != null">
              / 规则 {{ visit.minimumMinutes }} 分钟<span
                v-if="dwell !== null && dwell < visit.minimumMinutes"
              >
                · 低于阈值</span
              >
            </template>
          </dd>
          <dt>服务端材料</dt>
          <dd>
            {{ visit.photos }} 张已核门头照　{{ visit.verifiedFiles }} /
            {{ visit.files }} 个录音已核
          </dd>
          <dt>结果与接触</dt>
          <dd>{{ contactResult }}</dd>
          <dt>适用规则</dt>
          <dd>{{ visit.ruleVersion || '待同步' }}</dd>
          <template v-if="reason"
            ><dt>核验依据</dt>
            <dd>{{ reason }}</dd></template
          >
        </dl>
      </section>
    </div>
    <template v-if="visit" #footer>
      <div class="visit-footer">
        <el-button v-if="canRisk" @click="openCases">查看核查事项</el-button>
        <el-button v-if="canMaterials" @click="evidence = toTrackVisit(visit)">查看材料</el-button>
        <el-button
          v-if="canLocate"
          class="locate-button"
          type="primary"
          @click="$emit('locate', visit)"
          >定位到工作日地图</el-button
        >
      </div>
    </template>
  </el-drawer>
  <el-drawer
    :model-value="!!evidence"
    title="拜访材料"
    size="min(900px, 98vw)"
    append-to-body
    destroy-on-close
    @close="evidence = null"
  >
    <SalesVisitEvidence
      v-if="evidence && visit"
      :visit="evidence"
      :employee-name="visit.name"
      from-fieldwork
      @back="evidence = null"
      @history="evidence = $event"
      @changed="$emit('changed')"
    />
  </el-drawer>
  <el-drawer
    v-model="casesOpen"
    title="拜访核查事项"
    size="min(460px, 96vw)"
    append-to-body
    destroy-on-close
    @close="closeCases"
  >
    <el-alert v-if="caseError" :title="caseError" type="error" :closable="false" />
    <p v-else-if="loadingCases" role="status">正在读取核查事项</p>
    <SalesFieldworkCasePanel v-else :cases="cases" @changed="caseChanged" />
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fieldClock, type TrackVisit } from '@/api/core/sales-fieldwork'
import {
  assessmentNames,
  recordings,
  toTrackVisit,
  visitAssessmentReason,
  visitDwellMinutes,
  type ReportVisit,
} from '@/api/core/sales-fieldwork-report'
import {
  visitCases,
  visitRecordings,
  type FieldworkCase,
  type RecordingClip,
} from '@/api/core/sales-fieldwork-review'
import { displayDateTime } from '@/utils/business-date'
import SalesFieldworkCasePanel from './SalesFieldworkCasePanel.vue'

const labels: Record<string, string> = {
  CONTACTED: '已接洽',
  STORE_CLOSED: '门店关闭',
  KP_ABSENT: '关键人不在',
  REFUSED: '拒访',
  OTHER_NO_CONTACT: '未接洽',
  HIGH: '高意向',
  MEDIUM: '中意向',
  LOW: '低意向',
  NONE: '暂无意向',
}
const SalesVisitEvidence = defineAsyncComponent(() => import('./SalesVisitEvidence.vue'))
const props = defineProps<{ visit: ReportVisit | null; canLocate?: boolean }>()
const emit = defineEmits<{ close: []; locate: [visit: ReportVisit]; changed: [] }>()
const auth = useAuthStore()
const canAudio = computed(() => auth.hasPermission('sales:recording:sensitive:play'))
const canRisk = computed(() => auth.hasPermission('sales:risk:read'))
const canMaterials = computed(
  () => canAudio.value || canRisk.value || auth.hasPermission('sales:evidence:sensitive:read'),
)
const dwell = computed(() => (props.visit ? visitDwellMinutes(props.visit) : null))
const reason = computed(() => (props.visit ? visitAssessmentReason(props.visit) : ''))
const organization = computed(() =>
  [props.visit?.city, props.visit?.departmentName].filter(Boolean).join(' / '),
)
const contactResult = computed(
  () =>
    [props.visit?.outcome, props.visit?.intention]
      .filter((value): value is string => !!value)
      .map((value) => labels[value] || value)
      .join(' / ') || '待记录',
)
const evidence = ref<TrackVisit | null>(null)
const clips = ref<RecordingClip[]>([])
const loadingRecordings = ref(false)
const recordingError = ref('')
const casesOpen = ref(false)
const cases = ref<FieldworkCase[]>([])
const loadingCases = ref(false)
const caseError = ref('')
let casesRequest: AbortController | undefined

function closeCases() {
  casesRequest?.abort()
  casesOpen.value = false
  cases.value = []
  caseError.value = ''
}
async function openCases() {
  if (!props.visit || !canRisk.value) return
  closeCases()
  const request = new AbortController()
  casesRequest = request
  casesOpen.value = true
  loadingCases.value = true
  try {
    const data = await visitCases(props.visit.id, request.signal)
    if (!request.signal.aborted) cases.value = data
  } catch (error) {
    if (!request.signal.aborted)
      caseError.value = error instanceof Error ? error.message : '读取核查事项失败'
  } finally {
    if (!request.signal.aborted) loadingCases.value = false
  }
}
function caseChanged(item: FieldworkCase) {
  cases.value = cases.value.map((row) => (row.id === item.id ? item : row))
  emit('changed')
}
watch(
  () => [props.visit?.id, auth.user?.id, auth.user?.tenantId, canMaterials.value, canRisk.value],
  () => {
    evidence.value = null
    closeCases()
  },
)
watch(
  () => [props.visit?.id, props.visit?.files, auth.user?.id, auth.user?.tenantId, canAudio.value],
  async (_value, _oldValue, onCleanup) => {
    clips.value = []
    recordingError.value = ''
    loadingRecordings.value = false
    if (!props.visit?.files || !canAudio.value) return
    const request = new AbortController()
    onCleanup(() => request.abort())
    loadingRecordings.value = true
    try {
      const data = await visitRecordings(props.visit.id, request.signal)
      if (!request.signal.aborted)
        clips.value = data.clips.filter((clip) => clip.uploadStatus === 'RECEIVED')
    } catch (error) {
      if (!request.signal.aborted)
        recordingError.value = error instanceof Error ? error.message : '读取录音片段失败'
    } finally {
      if (!request.signal.aborted) loadingRecordings.value = false
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => casesRequest?.abort())
</script>

<style scoped lang="scss">
:global(.field-visit-drawer) {
  --el-drawer-padding-primary: 20px;
  color: #1a3340;
  font-variant-numeric: tabular-nums;
}
:global(.field-visit-drawer .el-drawer__header) {
  margin-bottom: 0;
  padding-bottom: 14px;
  border-bottom: 1px solid #d5dfe2;
}
:global(.field-visit-drawer .el-drawer__body) {
  padding-top: 15px;
}
:global(.field-visit-drawer .el-drawer__footer) {
  padding: 11px 20px;
  border-top: 1px solid #e5ecee;
}
.visit-heading,
.visit-identity,
.visit-footer {
  display: flex;
  align-items: center;
  gap: 7px 12px;
}
.visit-heading {
  justify-content: space-between;
  width: 100%;
}
.visit-heading > div {
  min-width: 0;
}
.visit-heading small {
  overflow-wrap: anywhere;
  color: #495f6e;
  font-size: 12px;
}
.visit-heading h2 {
  margin: 5px 0 0;
  color: #1a3340;
  font-size: 21px;
  line-height: 1.2;
}
.visit-identity,
.visit-muted {
  margin: 0 0 9px;
  color: #495f6e;
  font-size: 12px;
}
.visit-identity,
.visit-footer {
  flex-wrap: wrap;
}
.visit-times,
.visit-facts {
  display: grid;
  margin: 0;
}
.visit-times {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 8px;
}
.visit-times > div {
  min-width: 0;
  padding: 6px 8px;
  border-left: 2px solid #a2c9c1;
  background: #eff4f3;
}
.visit-times dt {
  color: #495f6e;
  font-size: 11px;
}
.visit-times dd {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}
.visit-facts {
  grid-template-columns: minmax(100px, max-content) minmax(0, 1fr);
  font-size: 13px;
}
.visit-facts dt,
.visit-facts dd {
  margin: 0;
  padding: 7px 0;
}
.visit-facts dt {
  color: #495f6e;
}
.visit-facts dd {
  padding-left: 10px;
  text-align: right;
  overflow-wrap: anywhere;
}
.visit-facts dt ~ dt,
.visit-facts dd ~ dd {
  border-top: 1px solid #e5ecee;
}
.visit-detail h3 {
  margin: 11px 0 5px;
  color: #1a3340;
  font-size: 14px;
}
.visit-recordings table {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
  text-align: left;
  font-size: 12px;
}
.visit-recordings th,
.visit-recordings td {
  padding: 5px 8px;
  border-bottom: 1px solid #e5ecee;
}
.visit-recordings th {
  background: #eef3f6;
  color: #495f6e;
}
.visit-recordings .visit-muted {
  margin: 5px 0 0;
}
.clip-status {
  padding: 2px 6px;
  border-radius: 3px;
  background: #f8eddb;
  color: #805016;
}
.clip-status.verified {
  background: #e4f1eb;
  color: #226555;
}
.assessment-status {
  --tone: #566e7c;
  color: var(--tone);
  font-size: 12px;
}
.assessment-status::before {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 5px;
  border-radius: 50%;
  background: currentColor;
  vertical-align: 2px;
  content: '';
}
.assessment-status[data-status='VALID'] {
  --tone: #226555;
}
.assessment-status[data-status='PENDING'] {
  --tone: #855013;
}
.assessment-status[data-status='INVALID'] {
  --tone: #a23442;
}
.assessment-status[data-status='IN_PROGRESS'] {
  --tone: #226b82;
}
.visit-footer .el-button + .el-button {
  margin-left: 0;
}
.visit-footer .locate-button {
  --el-button-bg-color: #1a3441;
  --el-button-border-color: #1a3441;
  --el-button-hover-bg-color: #265363;
  --el-button-hover-border-color: #265363;
}
</style>
