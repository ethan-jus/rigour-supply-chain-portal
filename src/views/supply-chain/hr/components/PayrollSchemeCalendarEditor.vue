<template>
  <el-form label-position="top" :disabled="disabled">
    <el-alert
      title="原始打卡与拜访记录由销售打卡服务提供。此处仅配置工资计算口径；出勤天数与每日任务分别计算，HR修正出勤不改变原始记录或任务次数。"
      type="info"
      :closable="false"
    />
    <el-form-item label="每周工作日" required
      ><el-checkbox-group v-model="form.calendar.weekdays"
        ><el-checkbox v-for="(name, index) in weekdays" :key="name" :value="index + 1">{{
          name
        }}</el-checkbox></el-checkbox-group
      ></el-form-item
    >
    <el-form-item label="大小周基准日期（留空使用固定周）"
      ><el-date-picker
        v-model="form.calendar.alternateAnchor"
        value-format="YYYY-MM-DD"
        placeholder="选择正常周中的任意日期"
        clearable
    /></el-form-item>
    <el-form-item v-if="form.calendar.alternateAnchor" label="交替周工作日"
      ><el-checkbox-group v-model="form.calendar.alternateWeekdays"
        ><el-checkbox v-for="(name, index) in weekdays" :key="name" :value="index + 1">{{
          name
        }}</el-checkbox></el-checkbox-group
      ></el-form-item
    >
    <div class="scheme-grid">
      <el-form-item label="额外工作日期"
        ><el-date-picker
          v-model="form.calendar.workDays"
          type="dates"
          value-format="YYYY-MM-DD"
          placeholder="选择调休上班日期"
      /></el-form-item>
      <el-form-item label="休息及节假日"
        ><el-date-picker
          v-model="form.calendar.restDays"
          type="dates"
          value-format="YYYY-MM-DD"
          placeholder="选择无需完成任务的日期"
      /></el-form-item>
      <el-form-item label="过程免考核日期"
        ><el-date-picker
          v-model="form.calendar.exemptDays"
          type="dates"
          value-format="YYYY-MM-DD"
          placeholder="免考核仍保留考勤记录"
      /></el-form-item>
    </div>
    <el-divider content-position="left">薪资核算的打卡日期归属窗口（北京时间）</el-divider>
    <div class="scheme-grid">
      <el-form-item label="开始时间（包含）"
        ><el-time-picker
          v-model="form.calendar.window.start"
          value-format="HH:mm:ss"
          format="HH:mm"
      /></el-form-item>
      <el-form-item label="结束时间（不包含）"
        ><el-time-picker v-model="form.calendar.window.end" value-format="HH:mm:ss" format="HH:mm"
      /></el-form-item>
      <el-form-item label="结束日期"
        ><el-switch v-model="form.calendar.window.nextDay" active-text="次日" inactive-text="当日"
      /></el-form-item>
      <el-form-item label="窗口外打卡"
        ><el-select v-model="form.calendar.window.outside"
          ><el-option label="不计入考核，保留原始记录" value="IGNORE" /><el-option
            label="按打卡自然日计入"
            value="CALENDAR_DAY" /></el-select
      ></el-form-item>
    </div>
    <p class="field-hint">
      例如当日09:00至次日06:00，次日凌晨打卡归前一工作日。06:00至09:00按上方“窗口外打卡”处理，不能跨日抵消任务缺项。
    </p>
  </el-form>
</template>
<script setup lang="ts">
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
defineProps<{ disabled?: boolean }>()
const form = defineModel<PayrollSchemeDefinition>({ required: true })
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
</script>
