<template>
  <el-drawer
    :model-value="open"
    title="员工工作日指标"
    size="min(450px,98vw)"
    @close="$emit('close')"
  >
    <strong>{{ row.employeeName }}　{{ date }}</strong>
    <dl>
      <dt>工作打卡 / 工作时长</dt>
      <dd>
        {{ row.punchCount }} 次 / {{ duration(row.workMinutes)
        }}{{ row.status === 'ACTIVE' ? ' 暂计' : '' }}
      </dd>
      <dt>已访门店 / 完成到店</dt>
      <dd>{{ row.storeCount }} 家 / {{ row.visitCount }} 次</dd>
      <dt>有效拜访 / 进行中</dt>
      <dd>
        {{ row.effectiveVisits }} 次<span v-if="row.visits.some((v) => v.assessment === 'UNKNOWN')"
          >（另有 {{ row.visits.filter((v) => v.assessment === 'UNKNOWN').length }} 次待同步）</span
        >
        / {{ row.visits.filter((v) => !v.departed).length }} 次
      </dd>
      <dt>完成计划 / 排定计划</dt>
      <dd>{{ row.completedPlans }} / {{ row.planned }}</dd>
      <dt>已知到店停留</dt>
      <dd>
        {{
          Math.floor(
            row.visits.reduce(
              (n, v) =>
                n + (v.departed ? Math.max(0, Date.parse(v.departed) - Date.parse(v.arrived)) : 0),
              0,
            ) / 60000,
          )
        }}
        分钟
      </dd>
      <dt>录音 / 已核时长</dt>
      <dd>
        {{ row.files }} 个 / {{ recordings(row.files, row.verifiedFiles, row.verifiedMillis)
        }}<span v-if="row.files > row.verifiedFiles">
          · {{ row.files - row.verifiedFiles }} 个待核</span
        >
      </dd>
      <dt>已记录里程</dt>
      <dd>{{ fieldDistance(row.distanceMeters, true) }}</dd>
      <dt>当日新增企微</dt>
      <dd>{{ row.newContacts == null ? '待同步' : row.newContacts + ' 人' }}</dd>
      <dt>企微来源截止</dt>
      <dd>
        {{ coverageNames[row.contactStatus] || '待核' }}　{{ displayDateTime(row.contactsThrough) }}
      </dd>
    </dl>
    <h4>工作时段</h4>
    <p v-for="p in row.periods" :key="p.start">
      {{ fieldClock(p.start) }} — {{ p.end ? fieldClock(p.end) : workNames[row.status] }}
    </p>
    <p v-if="!row.periods.length">没有已收打卡</p>
    <template v-if="row.contactTimes.length"
      ><h4>新增建联时间</h4>
      <p>{{ row.contactTimes.map(fieldClock).join('、') }}</p></template
    >
  </el-drawer>
</template>
<script setup lang="ts">
import { fieldClock, fieldDistance } from '@/api/core/sales-fieldwork'
import {
  duration,
  recordings,
  workNames,
  type ReportEmployee,
} from '@/api/core/sales-fieldwork-report'
import { displayDateTime } from '@/utils/business-date'
defineProps<{ row: ReportEmployee; date: string; open: boolean }>()
defineEmits<{ close: [] }>()
const coverageNames: Record<string, string> = {
  NOT_CONNECTED: '未接入',
  READY: '已覆盖',
  PARTIAL: '覆盖不完整',
  STALE: '未同步至该日',
  UNAVAILABLE: '来源暂不可用',
}
</script>
<style scoped>
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  font-variant-numeric: tabular-nums;
}
dt,
dd {
  margin: 0;
  padding: 7px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
dd {
  text-align: right;
}
dt,
p {
  color: var(--el-text-color-secondary);
}
</style>
