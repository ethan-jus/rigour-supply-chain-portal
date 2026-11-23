<template>
  <article class="visit-detail-page">
    <header class="field-heading">
      <div>
        <div class="visit-detail-title">
          <h1>{{ trackVisit.storeName }}</h1>
          <span class="field-status" :data-status="visit.assessment">
            {{ assessmentNames[visit.assessment] || '待核' }}
          </span>
        </div>
        <div class="visit-detail-context">
          <time :datetime="visit.date">{{ visit.date }}</time>
          <span>{{ [visit.departmentName, visit.name].filter(Boolean).join(' / ') }}</span>
          <span>当日第 {{ visit.sequence }} 站</span>
          <span>{{ visit.planId ? '计划内' : '计划外' }}</span>
          <span class="visit-identifier">{{ visit.id }}</span>
        </div>
      </div>
      <el-button v-if="canMap" :icon="MapLocation" @click="emit('map')">工作日地图</el-button>
    </header>

    <SalesVisitEvidence
      :visit="trackVisit"
      :employee-name="visit.name"
      inline
      @capture="emit('history', $event)"
      @changed="emit('changed')"
    >
      <template #facts>
        <section class="field-panel facts-panel" aria-labelledby="visit-facts-heading">
          <h2 id="visit-facts-heading">本次拜访</h2>
          <dl>
            <dt>到店</dt>
            <dd>{{ fieldClock(visit.arrived) }}</dd>
            <dt>离店</dt>
            <dd>{{ visit.departed ? fieldClock(visit.departed) : '进行中' }}</dd>
            <dt>现场停留</dt>
            <dd>{{ dwell === null ? '—' : dwell + ' 分钟' }}</dd>
            <dt>拜访目的</dt>
            <dd>{{ visit.objective || '未记录' }}</dd>
            <dt>现场结果</dt>
            <dd>{{ visit.result || '未记录' }}</dd>
          </dl>
        </section>
        <section class="field-panel facts-panel" aria-labelledby="visit-rules-heading">
          <h2 id="visit-rules-heading">核验依据</h2>
          <dl>
            <dt>现场停留要求</dt>
            <dd>{{ visit.minimumMinutes == null ? '—' : visit.minimumMinutes + ' 分钟' }}</dd>
            <dt>已核门头照</dt>
            <dd>{{ visit.photos }} 张</dd>
            <dt>录音文件</dt>
            <dd>{{ visit.files }} 个 / {{ visit.verifiedFiles }} 个已核</dd>
            <dt>已核录音时长</dt>
            <dd>{{ recordings(visit.files, visit.verifiedFiles, visit.verifiedMillis) }}</dd>
            <dt>适用规则</dt>
            <dd>{{ visit.ruleVersion || '待同步' }}</dd>
            <template v-if="reason"
              ><dt>核验备注</dt>
              <dd>{{ reason }}</dd></template
            >
          </dl>
        </section>
      </template>
      <template #materials>
        <div class="visit-received">
          <strong>服务端收到到离店记录</strong>
          <span>{{ visit.receivedAt ? displayDateTime(visit.receivedAt) : '待同步' }}</span>
        </div>
      </template>
    </SalesVisitEvidence>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MapLocation } from '@element-plus/icons-vue'
import { fieldClock } from '@/api/core/sales-fieldwork'
import type { HistoryCapture } from '@/api/core/sales-fieldwork-evidence'
import {
  assessmentNames,
  recordings,
  toTrackVisit,
  visitAssessmentReason,
  visitDwellMinutes,
  type ReportVisit,
} from '@/api/core/sales-fieldwork-report'
import { displayDateTime } from '@/utils/business-date'
import SalesVisitEvidence from './SalesVisitEvidence.vue'

const props = defineProps<{ visit: ReportVisit; canMap: boolean }>()
const emit = defineEmits<{ map: []; history: [item: HistoryCapture]; changed: [] }>()
const trackVisit = computed(() => toTrackVisit(props.visit))
const dwell = computed(() => visitDwellMinutes(props.visit))
const reason = computed(() => visitAssessmentReason(props.visit))
</script>

<style scoped lang="scss" src="./sales-fieldwork.scss"></style>
<style scoped lang="scss">
.visit-detail-page {
  display: grid;
  gap: 14px;
}
.visit-detail-title,
.visit-detail-context {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
.visit-detail-title h1 {
  margin: 0;
  font-size: var(--app-font-size-heading);
  overflow-wrap: anywhere;
}
.visit-detail-context {
  margin-top: 6px;
  color: var(--field-muted);
  font-size: 12px;
}
.visit-identifier {
  overflow-wrap: anywhere;
}
.facts-panel {
  padding: 12px 15px;
}
.facts-panel h2 {
  margin: 0 0 8px;
  font-size: 15px;
}
.facts-panel dl {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  margin: 0;
}
.facts-panel dt,
.facts-panel dd {
  border-top: 1px solid var(--field-line);
  padding: 7px 0;
  margin: 0;
}
.facts-panel dt {
  color: var(--field-muted);
  padding-right: 12px;
}
.facts-panel dd {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.visit-received {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 14px;
}
.visit-received span {
  color: var(--field-muted);
}
</style>
