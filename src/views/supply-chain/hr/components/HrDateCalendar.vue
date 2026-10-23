<template>
  <section
    class="hr-date-calendar"
    :class="{ 'month-view': appearance === 'month', 'calendar-pending': pending }"
    :aria-label="label"
  >
    <div class="calendar-toolbar">
      <div class="month-navigation">
        <button
          v-if="appearance === 'month'"
          type="button"
          class="month-arrow"
          aria-label="上一月"
          @click="moveMonth(-1)"
        >
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <el-date-picker
          v-model="month"
          type="month"
          value-format="YYYY-MM"
          :format="appearance === 'month' ? 'YYYY年M月' : 'YYYY-MM'"
          :clearable="false"
          aria-label="日历月份"
        />
        <button
          v-if="appearance === 'month'"
          type="button"
          class="month-arrow"
          aria-label="下一月"
          @click="moveMonth(1)"
        >
          <el-icon><ArrowRight /></el-icon>
        </button>
        <button
          v-if="appearance === 'month'"
          type="button"
          class="current-month"
          @click="month = attendanceMonth()"
        >
          本月
        </button>
      </div>
      <div v-if="appearance === 'month' && !pending" class="calendar-summary" aria-live="polite">
        <span
          >{{ unselectedText }} <strong>{{ dates.length - monthSelected }}</strong> 天</span
        >
        <span class="selected-summary"
          >{{ selectedText }} <strong>{{ monthSelected }}</strong> 天</span
        >
      </div>
      <span v-else-if="appearance !== 'month' && !pending"
        >{{ selectedText }} {{ monthSelected }} 天 · 点击日期切换</span
      >
      <slot name="actions" />
    </div>
    <div class="calendar-grid">
      <span v-for="day in weekdays" :key="day" class="weekday">{{ day }}</span>
      <template v-if="appearance !== 'month'">
        <span v-for="n in leading" :key="`empty-${n}`" />
      </template>
      <button
        v-for="cell in cells"
        :key="cell.date"
        type="button"
        class="calendar-day"
        :disabled="disabled || pending || !cell.current"
        :data-date="cell.date"
        :class="{
          selected: cell.selected,
          'outside-month': !cell.current,
          weekend: cell.weekend,
          today: cell.date === today,
          'range-start': cell.rangeStart,
          'range-end': cell.rangeEnd,
          'makeup-workday': cell.current && !cell.selected && makeupDays.includes(cell.date),
        }"
        :aria-pressed="cell.current && !pending ? cell.selected : undefined"
        :aria-current="cell.date === today ? 'date' : undefined"
        :aria-label="`${cell.date} ${cell.current ? (pending ? '安排暂不可用' : cell.selected ? selectedText : unselectedText) : '非本月日期'}`"
        @click="toggle(cell.date)"
      >
        <template v-if="appearance === 'month'">
          <span class="date-heading">
            <span class="lunar-date">{{ cell.lunar }}</span>
            <strong class="day-number">{{ Number(cell.date.slice(-2)) }}<small>日</small></strong>
          </span>
          <span v-if="cell.current && !pending" class="day-status">{{
            dayLabels[cell.date] || (cell.selected ? selectedText : unselectedText)
          }}</span>
        </template>
        <template v-else>
          <strong>{{ Number(cell.date.slice(-2)) }}</strong>
          <span v-if="!pending">{{ cell.selected ? selectedText : unselectedText }}</span>
        </template>
      </button>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { attendanceMonth } from '@/api/core/hr-attendance'
import { BUSINESS_TIME_ZONE, businessDate } from '@/utils/business-date'
const props = withDefaults(
  defineProps<{
    disabled?: boolean
    label?: string
    selectedText?: string
    unselectedText?: string
    appearance?: 'compact' | 'month'
    pending?: boolean
    dayLabels?: Record<string, string>
    makeupDays?: string[]
  }>(),
  {
    label: '日期选择日历',
    selectedText: '已选择',
    unselectedText: '未选择',
    appearance: 'compact',
    pending: false,
    dayLabels: () => ({}),
    makeupDays: () => [],
  },
)
const values = defineModel<string[]>({ required: true })
const month = defineModel<string>('month', { default: () => attendanceMonth() })
const today = businessDate(new Date())
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const first = computed(() => new Date(`${month.value}-01T00:00:00Z`))
const leading = computed(() => (first.value.getUTCDay() + 6) % 7)
const dates = computed(() => {
  if (!/^\d{4}-\d{2}$/.test(month.value)) return []
  const count = new Date(
    Date.UTC(first.value.getUTCFullYear(), first.value.getUTCMonth() + 1, 0),
  ).getUTCDate()
  return Array.from({ length: count }, (_, i) => `${month.value}-${String(i + 1).padStart(2, '0')}`)
})
const selected = computed(() => new Set(values.value))
const monthSelected = computed(() => dates.value.filter((date) => selected.value.has(date)).length)
const lunarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
  month: 'long',
  day: 'numeric',
  timeZone: BUSINESS_TIME_ZONE,
})
const lunarDays = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
]
function lunarLabel(date: string) {
  if (lunarFormatter.resolvedOptions().calendar !== 'chinese') return ''
  const parts = lunarFormatter.formatToParts(new Date(`${date}T12:00:00Z`))
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return day === 1 ? parts.find((part) => part.type === 'month')?.value : lunarDays[day - 1]
}
const cells = computed(() => {
  const count = Math.ceil((leading.value + dates.value.length) / 7) * 7
  const displayed =
    props.appearance === 'month'
      ? Array.from({ length: count }, (_, index) =>
          new Date(first.value.getTime() + (index - leading.value) * 86400000)
            .toISOString()
            .slice(0, 10),
        )
      : dates.value
  return displayed.map((date, index) => ({
    date,
    current: date.startsWith(`${month.value}-`),
    selected: date.startsWith(`${month.value}-`) && selected.value.has(date),
    weekend: [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()),
    lunar: props.appearance === 'month' ? lunarLabel(date) : '',
    rangeStart: index % 7 === 0 || !selected.value.has(displayed[index - 1] ?? ''),
    rangeEnd: index % 7 === 6 || !selected.value.has(displayed[index + 1] ?? ''),
  }))
})
function moveMonth(offset: number) {
  month.value = new Date(
    Date.UTC(first.value.getUTCFullYear(), first.value.getUTCMonth() + offset, 1),
  )
    .toISOString()
    .slice(0, 7)
}
function toggle(date: string) {
  if (props.disabled || props.pending || !date.startsWith(`${month.value}-`)) return
  const next = new Set(values.value)
  if (next.has(date)) next.delete(date)
  else next.add(date)
  values.value = [...next].sort()
}
</script>
<style scoped>
.calendar-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin: 16px 0;
  color: var(--el-text-color-secondary);
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}
.weekday {
  text-align: center;
  padding: 8px 0;
  color: var(--el-text-color-secondary);
}
.calendar-day {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 68px;
  padding: 10px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.calendar-day strong {
  font-size: 15px;
}
.calendar-day span {
  font-size: 12px;
}
.calendar-day.selected {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.calendar-day:disabled {
  cursor: default;
  opacity: 0.65;
}
.month-navigation {
  display: flex;
  align-items: center;
  gap: 8px;
}
.month-view .calendar-toolbar {
  gap: 20px;
  margin: 16px 0 12px;
}
.month-view .month-navigation :deep(.el-date-editor) {
  width: 148px;
}
.month-arrow,
.current-month {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  min-width: 32px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.month-arrow:hover,
.current-month:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
}
.calendar-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-left: auto;
  font-size: 13px;
}
.calendar-summary strong {
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}
.selected-summary,
.selected-summary strong {
  color: var(--el-color-primary);
}
.month-view .calendar-grid {
  gap: 0;
  overflow: hidden;
  border-top: 1px solid var(--el-border-color-light);
  border-left: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}
.month-view .weekday {
  padding: 10px 0;
  background: var(--el-fill-color-light);
  border-right: 1px solid var(--el-border-color-light);
  border-bottom: 1px solid var(--el-border-color-light);
  font-size: 13px;
}
.month-view .calendar-day {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 108px;
  padding: 0;
  border: 0;
  border-right: 1px solid var(--el-border-color-light);
  border-bottom: 1px solid var(--el-border-color-light);
  border-radius: 0;
  text-align: left;
  background: var(--el-bg-color);
}
.month-view .calendar-day.weekend {
  background: var(--el-fill-color-extra-light);
}
.month-view .calendar-day:not(:disabled):hover {
  background: var(--el-color-primary-light-9);
}
.month-view .date-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
  padding: 12px 10px 10px;
}
.month-view .lunar-date {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.month-view .day-number {
  font-size: 22px;
  font-weight: 500;
  line-height: 28px;
  color: var(--el-text-color-primary);
}
.day-number small {
  margin-left: 2px;
  font-size: 13px;
}
.month-view .day-status {
  display: block;
  padding: 3px 10px;
  margin: 0 6px 18px;
  line-height: 20px;
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
  border-radius: 4px;
}
.month-view .selected .day-status {
  margin-right: 0;
  margin-left: 0;
  padding-right: 16px;
  padding-left: 16px;
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary-dark-2);
}
.month-view .selected.range-start .day-status {
  margin-left: 6px;
  padding-left: 10px;
  border-radius: 4px 0 0 4px;
}
.month-view .selected.range-end .day-status {
  margin-right: 6px;
  padding-right: 10px;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}
.month-view .makeup-workday .day-status {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.month-view .today .day-number {
  color: var(--el-color-primary);
  text-decoration: underline;
  text-underline-offset: 5px;
}
.month-view .calendar-day:focus-visible {
  position: relative;
  outline-offset: -3px;
}
.month-view .calendar-day:disabled {
  opacity: 1;
}
.month-view .outside-month .date-heading {
  opacity: 0.45;
}
.month-view .outside-month {
  background: var(--el-fill-color-extra-light);
}
@media (max-width: 600px) {
  .calendar-day {
    min-height: 56px;
    padding: 6px;
  }
  .calendar-summary {
    margin-left: 0;
  }
  .month-view .calendar-day {
    height: 86px;
  }
  .month-view .date-heading {
    padding: 8px 4px;
    gap: 2px;
  }
  .month-view .day-number {
    font-size: 17px;
  }
  .month-view .lunar-date {
    font-size: 11px;
  }
  .day-number small {
    display: none;
  }
  .month-view .day-status {
    padding: 2px 4px;
    margin: 0 2px 12px;
  }
  .month-view .selected .day-status {
    padding-right: 4px;
    padding-left: 4px;
  }
  .month-view .selected.range-start .day-status {
    margin-left: 2px;
    padding-left: 4px;
  }
  .month-view .selected.range-end .day-status {
    margin-right: 2px;
    padding-right: 4px;
  }
}
</style>
