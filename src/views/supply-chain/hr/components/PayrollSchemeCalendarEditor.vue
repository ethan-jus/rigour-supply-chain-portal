<template>
  <el-form label-position="top" :disabled="disabled">
    <h3 class="calendar-title">部门工作日历</h3>
    <div class="calendar-settings">
      <el-switch
        v-model="followStatutory"
        :disabled="disabled"
        active-text="跟随法定节假日"
        inactive-text="自定义工作日历"
      />
      <span class="field-hint">法定放假安排自动更新，大小周和特殊调休可直接在日历中调整。</span>
    </div>
    <div class="calendar-legend">
      <span class="work-legend">工作日</span><span class="rest-legend">休息日</span
      ><span class="makeup-legend">调休补班</span>
      <el-link
        v-if="reference?.sourceUrls[0]"
        :href="reference.sourceUrls[0]"
        target="_blank"
        rel="noopener noreferrer"
        type="primary"
        >节假日安排依据</el-link
      >
    </div>
    <p class="field-hint">
      {{ disabled ? '查看部门的工作与休息安排。' : '点击日期切换工作与休息，调整后保存规则。' }}
    </p>
    <div v-if="referenceMessage" class="calendar-notice" role="status" aria-live="polite">
      <el-icon v-if="referenceLoading" class="is-loading"><Loading /></el-icon>
      <span>{{ referenceMessage }}</span>
      <button v-if="canRetry" type="button" class="calendar-retry" @click="loadReference">
        重试
      </button>
    </div>
    <HrDateCalendar
      v-model="calendarRestDays"
      v-model:month="calendarMonth"
      :disabled="disabled"
      :pending="calendarUnavailable"
      :day-labels="dayLabels"
      :makeup-days="makeupDays"
      appearance="month"
      label="部门工作日历"
      selected-text="休息日"
      unselected-text="工作日"
    >
      <template #actions>
        <el-button
          v-if="!disabled && reference?.status === 'AVAILABLE'"
          link
          type="primary"
          @click="restoreMonth"
          >恢复本月法定安排</el-button
        >
      </template>
    </HrDateCalendar>
    <el-alert
      v-if="form.calendar.exemptDays.length"
      type="info"
      :closable="false"
      title="本历史规则含部门免考核日期，继续保留历史依据；新增个人免考核请在员工档案维护。"
    />
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
import { computed, ref, watch } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { attendanceMonth } from '@/api/core/hr-attendance'
import { getStatutoryCalendar, type StatutoryCalendarView } from '@/api/core/business-calendar'
import { ApiError } from '@/api/core/error'
import {
  calendarMonthDates,
  calendarWorkDate,
  resolveWorkCalendar,
  restoreStatutoryMonth,
} from '@/utils/hr-work-calendar'
import HrDateCalendar from './HrDateCalendar.vue'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
defineProps<{ disabled?: boolean }>()
const form = defineModel<PayrollSchemeDefinition>({ required: true })
const calendarMonth = ref(form.value.effectiveFrom.slice(0, 7) || attendanceMonth())
const reference = ref<StatutoryCalendarView | null>(null)
const referenceLoading = ref(false)
const referenceError = ref(false)
const referenceForbidden = ref(false)
let requestVersion = 0
async function loadReference() {
  const request = ++requestVersion
  reference.value = null
  referenceLoading.value = true
  referenceError.value = false
  referenceForbidden.value = false
  try {
    const year = Number(calendarMonth.value.slice(0, 4))
    const data = await getStatutoryCalendar(year)
    if (data.year !== year) throw new Error('返回的法定日历年份不一致，请重新获取')
    if (request === requestVersion) reference.value = data
  } catch (error) {
    if (request === requestVersion) {
      referenceError.value = true
      referenceForbidden.value = error instanceof ApiError && error.status === 403
    }
  } finally {
    if (request === requestVersion) referenceLoading.value = false
  }
}
watch(
  () => form.value.effectiveFrom,
  (value) => {
    if (value) calendarMonth.value = value.slice(0, 7)
  },
)
watch(
  () => calendarMonth.value.slice(0, 4),
  () => {
    void loadReference()
  },
  { immediate: true },
)
const effectiveCalendar = computed(() => resolveWorkCalendar(form.value.calendar, reference.value))
const calendarUnavailable = computed(() => !effectiveCalendar.value)
const referenceMessage = computed(() => {
  if (referenceLoading.value) return '正在加载日历…'
  if (referenceForbidden.value) return '暂无查看放假安排的权限，请联系管理员。'
  if (referenceError.value)
    return calendarUnavailable.value
      ? '暂时无法显示工作日历，请稍后重试。'
      : '暂时无法获取法定放假安排，当前自定义日历可继续使用。'
  if (reference.value?.status !== 'AVAILABLE')
    return reference.value?.status === 'NOT_PUBLISHED'
      ? `${calendarMonth.value.slice(0, 4)}年放假安排暂未公布，可切换其他年份查看。`
      : '暂时无法显示工作日历，请稍后重试。'
  return reference.value.stale ? '最新放假安排暂时无法获取，当前展示已保存的安排。' : ''
})
const canRetry = computed(
  () =>
    !referenceLoading.value &&
    !referenceForbidden.value &&
    (referenceError.value ||
      reference.value?.status === 'UNAVAILABLE' ||
      reference.value?.status === 'PENDING'),
)
const followStatutory = computed({
  get: () => form.value.calendar.source === 'STATUTORY',
  set: (value) => {
    if (value)
      form.value.calendar = {
        ...form.value.calendar,
        source: 'STATUTORY',
        referenceVersion: null,
        weekdays: [1, 2, 3, 4, 5],
        alternateWeekdays: [],
        alternateAnchor: null,
      }
    else
      form.value.calendar = {
        ...(effectiveCalendar.value || form.value.calendar),
        source: 'MANUAL',
        referenceVersion: null,
      }
  },
})
const monthDates = computed(() => calendarMonthDates(calendarMonth.value))
const calendarRestDays = computed({
  get: () =>
    effectiveCalendar.value
      ? monthDates.value.filter((date) => !calendarWorkDate(effectiveCalendar.value!, date))
      : [],
  set: (values: string[]) => {
    if (!effectiveCalendar.value) return
    const selected = new Set(values)
    const outside = (date: string) => !date.startsWith(`${calendarMonth.value}-`)
    const baseline =
      form.value.calendar.source === 'STATUTORY'
        ? resolveWorkCalendar(
            { ...form.value.calendar, workDays: [], restDays: [] },
            reference.value,
          )!
        : { ...form.value.calendar, restDays: [], workDays: [] }
    form.value.calendar.restDays = [
      ...form.value.calendar.restDays.filter(outside),
      ...monthDates.value.filter((date) => selected.has(date) && calendarWorkDate(baseline, date)),
    ].sort()
    form.value.calendar.workDays = [
      ...form.value.calendar.workDays.filter(outside),
      ...monthDates.value.filter(
        (date) => !selected.has(date) && !calendarWorkDate(baseline, date),
      ),
    ].sort()
  },
})
const dayLabels = computed(() => {
  const labels: Record<string, string> = {}
  if (!effectiveCalendar.value) return labels
  for (const day of reference.value?.days || []) {
    const work = calendarWorkDate(effectiveCalendar.value, day.date)
    labels[day.date] =
      day.type === 'HOLIDAY'
        ? `${day.name}（${work ? '班' : '休'}）`
        : day.type === 'MAKEUP' && work
          ? `${day.name}补班`
          : work
            ? '工作日'
            : '休息日'
  }
  return labels
})
const makeupDays = computed(
  () => reference.value?.days.filter((day) => day.type === 'MAKEUP').map((day) => day.date) || [],
)
function restoreMonth() {
  form.value.calendar = restoreStatutoryMonth(
    form.value.calendar,
    calendarMonth.value,
    reference.value,
  )
}
</script>
<style scoped>
.calendar-title {
  margin: 24px 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.calendar-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.calendar-retry {
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font: inherit;
  cursor: pointer;
}
.calendar-retry:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.calendar-settings,
.calendar-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin: 12px 0;
}
.calendar-legend {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.calendar-legend > span::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}
.work-legend::before {
  background: var(--el-color-success);
}
.rest-legend::before {
  background: var(--el-color-primary);
}
.makeup-legend::before {
  background: var(--el-color-warning);
}
</style>
