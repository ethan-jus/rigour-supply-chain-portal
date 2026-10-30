<template>
  <section class="attendance-exception-editor">
    <el-divider content-position="left">考勤异常登记</el-divider>
    <p class="field-hint">
      登记具体日期及处理方式：请假、调休时段免除相应打卡拜访任务；活动和缺卡说明作为核定依据。请同时核定出勤天数和缺失次数，原始记录保留。
    </p>
    <el-radio-group v-model="mode" :disabled="disabled" class="entry-mode" aria-label="日期录入方式"
      ><el-radio-button value="DATES">多选日期</el-radio-button
      ><el-radio-button value="RANGE">起止时间</el-radio-button></el-radio-group
    >
    <div v-if="mode === 'DATES'" class="date-entry-panel">
      <div class="date-rows">
        <div v-for="(row, index) in dateRows" :key="row.id" class="date-row">
          <span class="date-index">日期 {{ index + 1 }}</span>
          <el-date-picker
            class="row-date"
            v-model="row.date"
            type="date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            :default-value="new Date(`${month}-01T00:00:00`)"
            :aria-label="`异常日期${index + 1}`"
            placeholder="请选择日期"
            :disabled="disabled"
            :disabled-date="(date: Date) => dateUnavailable(date, row.id)"
          />
          <div class="row-time">
            <span v-if="row.allDay" class="whole-day-label">全天</span>
            <el-time-picker
              v-else
              v-model="row.times"
              is-range
              value-format="HH:mm"
              format="HH:mm"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              :aria-label="`日期${index + 1}的起止时间`"
              :disabled="disabled"
            />
          </div>
          <el-checkbox
            v-model="row.allDay"
            :disabled="disabled"
            :aria-label="`日期${index + 1}全天`"
            >全天</el-checkbox
          >
          <el-button
            link
            type="danger"
            :disabled="disabled || (dateRows.length === 1 && !row.date)"
            :aria-label="`移除日期${index + 1}`"
            @click="removeDate(row.id)"
            >移除</el-button
          >
        </div>
      </div>
      <div class="date-entry-actions">
        <el-button
          link
          type="primary"
          :disabled="disabled || dateRows.length >= 31"
          @click="addDate"
          >＋ 添加日期</el-button
        >
        <span class="field-hint">每个日期可分别设置时段，全天请勾选；日期不能重复。</span>
      </div>
    </div>
    <el-date-picker
      v-else
      v-model="range"
      type="datetimerange"
      value-format="YYYY-MM-DDTHH:mm:ss"
      start-placeholder="开始时间"
      end-placeholder="结束时间（不含）"
      :disabled="disabled"
      class="time-range"
      aria-label="异常起止时间"
    />
    <div class="exception-fields">
      <el-form-item label="时段处理方式" required
        ><el-select v-model="kind" :disabled="disabled"
          ><el-option v-for="item in kinds" :key="item.value" v-bind="item" /></el-select
      ></el-form-item>
      <el-form-item label="异常说明" required
        ><el-input
          v-model="reason"
          maxlength="500"
          :disabled="disabled"
          aria-label="异常说明"
          placeholder="填写调休或活动依据"
      /></el-form-item>
    </div>
    <el-button type="primary" :disabled="disabled" @click="add">添加异常记录</el-button>
    <p v-if="error" role="alert" class="entry-error">{{ error }}</p>
    <el-table v-if="model.length" :data="model" border class="exception-records">
      <el-table-column label="类型" width="110"
        ><template #default="{ row }">{{
          kinds.find((k) => k.value === row.kind)?.label || row.kind
        }}</template></el-table-column
      >
      <el-table-column label="日期 / 时间" min-width="190">
        <template #default="{ row }">
          <span v-if="isWholeDay(row as AttendanceExceptionPeriod)"
            >{{ row.start.slice(0, 10) }}（全天）</span
          >
          <div v-else class="period-times">
            <span>{{ row.start.replace('T', ' ') }}</span>
            <span>至 {{ row.end.replace('T', ' ') }}（不含）</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="说明" min-width="140" show-overflow-tooltip />
      <el-table-column width="70"
        ><template #default="{ $index }"
          ><el-button link type="danger" :disabled="disabled" @click="removeRecord($index)"
            >移除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
  </section>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AttendanceExceptionPeriod } from '@/api/core/hr-attendance'
const props = defineProps<{ month: string; disabled?: boolean }>()
const model = defineModel<AttendanceExceptionPeriod[]>({ required: true })
const mode = ref('DATES')
let nextDateId = 1
interface DateEntry {
  id: number
  date: string | null
  times: [string, string] | null
  allDay: boolean
}
const emptyDate = (id: number): DateEntry => ({ id, date: '', times: null, allDay: false })
const dateRows = ref<DateEntry[]>([emptyDate(0)])
const range = ref<[string, string] | null>(null),
  reason = ref(''),
  error = ref('')
const kind = ref<AttendanceExceptionPeriod['kind']>('COMPENSATORY_LEAVE')
const kinds = [
  { value: 'COMPENSATORY_LEAVE', label: '调休' },
  { value: 'PAID_LEAVE', label: '带薪请假' },
  { value: 'UNPAID_LEAVE', label: '非带薪请假' },
  { value: 'ACTIVITY', label: '活动报备' },
  { value: 'MISSING_PUNCH', label: '缺卡补充说明' },
]
watch([mode, dateRows, range, reason, model], () => (error.value = ''), { deep: true })
function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function nextDay(date: string) {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}
function isWholeDay(period: AttendanceExceptionPeriod) {
  return (
    /^00:00(?::00)?$/.test(period.start.slice(11)) &&
    /^00:00(?::00)?$/.test(period.end.slice(11)) &&
    nextDay(period.start.slice(0, 10)) === period.end.slice(0, 10)
  )
}
function dateUnavailable(date: Date, rowId: number) {
  const value = formatDate(date)
  return (
    !value.startsWith(`${props.month}-`) ||
    dateRows.value.some((row) => row.id !== rowId && row.date === value) ||
    model.value.some(
      (period) =>
        new Date(period.start).getTime() < new Date(`${nextDay(value)}T00:00:00`).getTime() &&
        new Date(period.end).getTime() > new Date(`${value}T00:00:00`).getTime(),
    )
  )
}
function addDate() {
  if (!props.disabled) dateRows.value.push(emptyDate(nextDateId++))
}
function removeDate(id: number) {
  if (props.disabled) return
  dateRows.value = dateRows.value.filter((row) => row.id !== id)
  if (!dateRows.value.length) addDate()
}
function removeRecord(index: number) {
  if (!props.disabled) model.value = model.value.filter((_, i) => i !== index)
}
function add() {
  if (props.disabled) return
  error.value = ''
  if (!reason.value.trim()) {
    error.value = '请填写异常说明'
    return
  }
  const selectedDates = dateRows.value.flatMap((row) => (row.date ? [row.date] : []))
  if (
    mode.value === 'DATES' &&
    selectedDates.some((date) => {
      const parsed = new Date(`${date}T00:00:00Z`)
      return (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date ||
        !date.startsWith(`${props.month}-`)
      )
    })
  ) {
    error.value = '请选择核算月份内的有效日期'
    return
  }
  if (mode.value === 'DATES') {
    for (const [index, row] of dateRows.value.entries()) {
      if (!row.date) {
        error.value = `请选择日期${index + 1}，或移除该行`
        return
      }
      if (!row.allDay) {
        if (
          !row.times ||
          row.times.length !== 2 ||
          row.times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
        ) {
          error.value = `请填写日期${index + 1}的开始时间和结束时间，或勾选全天`
          return
        }
        if (row.times[0] >= row.times[1]) {
          error.value = `日期${index + 1}的结束时间须晚于开始时间；跨天请使用“起止时间”`
          return
        }
      }
    }
  }
  const periods: [string, string][] =
    mode.value === 'RANGE'
      ? range.value
        ? [range.value]
        : []
      : dateRows.value.map((row) =>
          row.allDay
            ? [`${row.date}T00:00:00`, `${nextDay(row.date!)}T00:00:00`]
            : [`${row.date}T${row.times![0]}:00`, `${row.date}T${row.times![1]}:00`],
        )
  if (!periods.length) {
    error.value = '请选择日期或起止时间'
    return
  }
  const pending = periods.map(([start, end]) => ({
    start,
    end,
    kind: kind.value,
    reason: reason.value.trim(),
  }))
  const all = [...model.value, ...pending].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  )
  if (all.length > 100) {
    error.value = '单月异常记录最多100条'
    return
  }
  const monthStart = `${props.month}-01T00:00:00`
  const nextMonth = new Date(`${monthStart}Z`)
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
  const monthEnd = nextMonth.toISOString().slice(0, 19)
  if (
    pending.some(
      (p) =>
        !Number.isFinite(new Date(p.start).getTime()) ||
        !Number.isFinite(new Date(p.end).getTime()) ||
        new Date(p.start).getTime() >= new Date(monthEnd).getTime() ||
        new Date(p.end).getTime() <= new Date(monthStart).getTime(),
    )
  ) {
    error.value = '异常起止时间须与核算月份有交集'
    return
  }
  if (
    all.some(
      (p, i) =>
        new Date(p.start).getTime() >= new Date(p.end).getTime() ||
        (i > 0 && new Date(p.start).getTime() < new Date(all[i - 1]!.end).getTime()),
    )
  ) {
    error.value = '日期或时间段不能重复、重叠，且结束时间须晚于开始时间'
    return
  }
  if (
    all.some(
      (p, i) =>
        i > 0 &&
        p.start.slice(0, 10) <= formatDate(new Date(new Date(all[i - 1]!.end).getTime() - 1)),
    )
  ) {
    error.value = '日期不能重复登记，同一天的异常请合并填写'
    return
  }
  model.value = all
  dateRows.value = [emptyDate(nextDateId++)]
  range.value = null
  reason.value = ''
}
</script>
<style scoped>
.attendance-exception-editor {
  margin-bottom: 20px;
}
.field-hint {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: var(--app-font-size-base);
  line-height: 1.6;
}
.entry-mode {
  margin: 16px 0;
}
.date-entry-panel {
  padding: 16px;
  margin-bottom: 20px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}
.date-rows {
  display: grid;
  gap: 12px;
}
.date-row {
  display: grid;
  grid-template-columns: auto minmax(140px, 1fr) minmax(220px, 1.4fr) auto auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.date-index {
  flex-shrink: 0;
  color: var(--el-text-color-regular);
  font-size: var(--app-font-size-base);
}
.date-row :deep(.row-date.el-date-editor),
.row-time,
.row-time :deep(.el-date-editor) {
  width: 100%;
  min-width: 0;
}
.whole-day-label {
  display: block;
  padding-left: 12px;
  color: var(--el-text-color-secondary);
  font-size: var(--app-font-size-base);
}
.date-row :deep(.el-checkbox) {
  margin-right: 0;
}
.date-entry-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-top: 12px;
}
.exception-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 16px;
}
.period-times {
  display: flex;
  flex-direction: column;
  font-size: var(--app-font-size-base);
}
.time-range {
  display: flex;
  width: 100%;
  margin-bottom: 20px;
}
.entry-error {
  color: var(--el-color-danger);
  font-size: var(--app-font-size-base);
}
.exception-records {
  margin-top: 16px;
}
@media (max-width: 700px) {
  .date-row {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
  }
  .row-time {
    grid-column: 2 / -1;
    grid-row: 2;
  }
  .date-row + .date-row {
    padding-top: 12px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
  .exception-fields {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}
</style>
