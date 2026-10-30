<script setup lang="ts">
import { ref, watch } from 'vue'
import { displayCell } from '@/utils/business-display'
import type { AttendanceRow } from '@/api/core/hr-attendance'
import AttendanceAssessmentPanel from './AttendanceAssessmentPanel.vue'
import AttendanceEmploymentPeriod from './AttendanceEmploymentPeriod.vue'

const props = defineProps<{
  row: AttendanceRow
  month: string
  leaveText: string
  statusText: string
}>()
const activeTab = ref('result')
watch(
  () => props.row,
  () => {
    activeTab.value = 'result'
  },
)
const days = (value: number | null) => (value == null ? '待核对' : `${value} 天`)
const ruleLabels = {
  COMPANY: '公司默认',
  DEPARTMENT: '本部门规则',
  UNSET: '未设置',
  DISABLED: '规则已停用',
}
const sourceLabels = {
  AVAILABLE: '可用',
  UNLINKED: '待关联打卡账号',
  UNAVAILABLE: '暂不可用',
  FUTURE: '尚未开始',
}
const exceptionLabels = {
  COMPENSATORY_LEAVE: '调休',
  PAID_LEAVE: '带薪请假',
  UNPAID_LEAVE: '非带薪请假',
  ACTIVITY: '活动报备',
  MISSING_PUNCH: '缺卡补充说明',
}
</script>

<template>
  <section class="attendance-detail-layout" aria-label="考勤详情内容">
    <header class="business-detail-hero">
      <div>
        <span class="business-detail-kicker">{{ month }} 考勤记录</span>
        <h2>{{ row.employeeName }}</h2>
      </div>
      <el-tag>{{ statusText }}</el-tag>
    </header>
    <p class="field-hint">
      {{
        row.attendanceStatus === 'CONFIRMED'
          ? '以下为本次确认时保存的结果。'
          : '以下为当前统计和核定记录，尚未确认。'
      }}
    </p>
    <div class="attendance-readonly-metrics">
      <div>
        <span>应出勤</span><strong>{{ days(row.expectedDays) }}</strong>
      </div>
      <div>
        <span>实际出勤</span><strong>{{ days(row.actualDays) }}</strong>
      </div>
      <div>
        <span>核定缺卡</span
        ><strong
          >{{
            row.assessmentOverride?.missingCheckins ?? row.assessment?.missingCheckins ?? '待核对'
          }}
          次</strong
        >
      </div>
      <div>
        <span>核定缺拜访</span
        ><strong
          >{{
            row.assessmentOverride?.missingVisits ?? row.assessment?.missingVisits ?? '待核对'
          }}
          次</strong
        >
      </div>
    </div>
    <el-tabs v-model="activeTab" class="attendance-readonly-tabs"
      ><el-tab-pane label="核定结果" name="result">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="考勤月份">{{ month }}</el-descriptions-item>
          <el-descriptions-item label="考勤状态">{{ statusText }}</el-descriptions-item>
          <el-descriptions-item label="员工">{{ row.employeeName }}</el-descriptions-item>
          <el-descriptions-item label="员工编号">{{ row.employeeCode }}</el-descriptions-item>
          <el-descriptions-item label="部门">{{ row.departmentName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="应出勤天数">{{
            days(row.expectedDays)
          }}</el-descriptions-item>
          <el-descriptions-item label="原始打卡天数">{{
            days(row.punchDays)
          }}</el-descriptions-item>
          <el-descriptions-item label="应出勤规则来源">{{
            ruleLabels[row.ruleSource]
          }}</el-descriptions-item>
          <el-descriptions-item label="打卡来源状态">{{
            sourceLabels[row.sourceStatus]
          }}</el-descriptions-item>
          <el-descriptions-item label="实际出勤天数"
            >{{ days(row.actualDays)
            }}<span v-if="row.actualDaysOverride != null"> · 人工核定</span></el-descriptions-item
          >
          <el-descriptions-item label="缺勤天数"
            >{{ days(row.absentDays)
            }}<span v-if="row.absentDaysOverride != null"> · 人工核定</span></el-descriptions-item
          >
          <el-descriptions-item label="核定缺卡次数">{{
            row.assessmentOverride?.missingCheckins ?? row.assessment?.missingCheckins ?? '待核对'
          }}</el-descriptions-item>
          <el-descriptions-item label="核定缺拜访次数">{{
            row.assessmentOverride?.missingVisits ?? row.assessment?.missingVisits ?? '待核对'
          }}</el-descriptions-item>
          <el-descriptions-item label="请假类型">{{ leaveText }}</el-descriptions-item>
          <el-descriptions-item label="考勤核定说明"
            ><span class="reason-text">{{ row.reason || '-' }}</span></el-descriptions-item
          >
        </el-descriptions>
        <AttendanceEmploymentPeriod
          :month="month"
          :entry-date="row.entryDate"
          :leave-date="row.leaveDate"
          :confirmed="row.attendanceStatus === 'CONFIRMED'"
          compact
        /> </el-tab-pane
      ><el-tab-pane label="打卡与拜访依据" name="basis">
        <AttendanceAssessmentPanel
          :assessment="row.assessment"
          :adjustment="row.assessmentOverride"
        /> </el-tab-pane
      ><el-tab-pane label="异常时段与说明" name="exceptions">
        <el-table v-if="row.exceptions?.length" :data="row.exceptions" border>
          <el-table-column label="时段处理方式" width="150"
            ><template #default="{ row: period }">{{
              exceptionLabels[period.kind as keyof typeof exceptionLabels] || '其他处理方式'
            }}</template></el-table-column
          >
          <el-table-column label="开始时间" min-width="165"
            ><template #default="{ row: period }">{{
              period.start.replace('T', ' ')
            }}</template></el-table-column
          >
          <el-table-column label="结束时间（不含）" min-width="165"
            ><template #default="{ row: period }">{{
              period.end.replace('T', ' ')
            }}</template></el-table-column
          >
          <el-table-column
            prop="reason"
            label="异常说明"
            min-width="180"
            :formatter="displayCell"
          />
        </el-table>
        <p v-else class="field-hint">未登记异常时段。</p> </el-tab-pane
      ><el-tab-pane label="原始打卡日期" name="dates">
        <div v-if="row.dates.length" class="punch-dates">
          <el-tag v-for="date in row.dates" :key="date">{{ date }}</el-tag>
        </div>
        <p v-else class="field-hint">
          {{
            row.sourceStatus === 'AVAILABLE'
              ? '本月暂无已提交的打卡记录。'
              : '打卡来源尚不可用，不能视为零出勤。'
          }}
        </p>
      </el-tab-pane></el-tabs
    >
  </section>
</template>

<style scoped>
.field-hint {
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.reason-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.punch-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.attendance-readonly-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0;
}
.attendance-readonly-metrics > div {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 14px 16px;
  background: #f8fafc;
}
.attendance-readonly-metrics span {
  color: #64748b;
  font-size: 12px;
}
.attendance-readonly-metrics strong {
  font-size: 20px;
  font-weight: 600;
}
.attendance-readonly-tabs :deep(.el-tabs__item) {
  font-size: 13px;
}
@media (max-width: 700px) {
  .attendance-readonly-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
