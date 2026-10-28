<script setup lang="ts">
import type { AttendanceAssessmentOverride } from '@/api/core/hr-attendance/models/AttendanceAssessmentOverride'
import type { AttendanceAssessmentView } from '@/api/core/hr-attendance/models/AttendanceAssessmentView'
defineProps<{
  assessment?: AttendanceAssessmentView | null
  loading?: boolean
  error?: string
  adjustment?: AttendanceAssessmentOverride | null
}>()
</script>
<template>
  <div class="assessment-panel" v-loading="!!loading">
    <p v-if="adjustment" class="field-hint">
      人工核定：缺卡 {{ adjustment.missingCheckins ?? '沿用系统统计' }}；缺拜访
      {{ adjustment.missingVisits ?? '沿用系统统计' }}。核定说明：{{ adjustment.reason }}
    </p>
    <div class="assessment-totals">
      <span
        >缺卡：<strong>{{ assessment?.missingCheckins ?? '待核对' }}</strong
        >{{ assessment?.missingCheckins != null ? ' 次' : '' }}</span
      >
      <span
        >缺拜访：<strong>{{ assessment?.missingVisits ?? '待核对' }}</strong
        >{{ assessment?.missingVisits != null ? ' 次' : '' }}</span
      >
      <span v-if="assessment?.through">统计截至 {{ assessment.through }}</span>
    </div>
    <p class="field-hint">
      {{ error || assessment?.message || '历史确认快照未记录次数，或当前规则、来源尚不可用。' }}
    </p>
    <el-collapse v-if="assessment?.days.length">
      <el-collapse-item title="查看每日缺卡、缺拜访明细" name="days">
        <el-table :data="assessment.days" border max-height="300">
          <el-table-column prop="date" label="考核日" width="130" />
          <el-table-column prop="checkins" label="合格打卡" align="right" />
          <el-table-column prop="effectiveVisits" label="有效拜访" align="right" />
          <el-table-column prop="missingCheckins" label="缺卡（次）" align="right" />
          <el-table-column prop="missingVisits" label="缺拜访（次）" align="right" />
        </el-table>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>
<style scoped>
.assessment-panel {
  margin: 12px 0 20px;
}
.assessment-totals {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}
</style>
