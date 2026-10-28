<script setup lang="ts">
import { computed } from 'vue'
import { businessMonthRange } from '@/utils/business-date'

const props = defineProps<{
  month: string
  entryDate?: string | null
  leaveDate?: string | null
  confirmed?: boolean
}>()
const rangeText = (from: string, to: string) => (from === to ? from : `${from} 至 ${to}`)
function adjacentDate(value: string, offset: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
const period = computed(() => {
  if (!props.entryDate) return null
  const [first, last] = businessMonthRange(props.month)
  const from = props.entryDate > first ? props.entryDate : first
  const to = props.leaveDate && props.leaveDate < last ? props.leaveDate : last
  const excluded: string[] = []
  if (props.entryDate > first)
    excluded.push(
      `入职前不考核：${rangeText(first, props.entryDate > last ? last : adjacentDate(props.entryDate, -1))}`,
    )
  if (props.leaveDate && props.leaveDate < last)
    excluded.push(
      `离职后不考核：${rangeText(props.leaveDate < first ? first : adjacentDate(props.leaveDate, 1), last)}`,
    )
  return { text: from > to ? '本月无在职日期' : rangeText(from, to), excluded }
})
</script>

<template>
  <section class="employment-period" aria-label="入离职考核范围">
    <div class="employment-facts">
      <span
        >入职日期：<strong>{{ entryDate || '待核对' }}</strong></span
      >
      <span v-if="leaveDate"
        >离职日期：<strong>{{ leaveDate }}</strong></span
      >
      <span
        >本月在职范围：<strong>{{ period?.text || '待核对' }}</strong></span
      >
    </div>
    <p v-for="text in period?.excluded" :key="text" class="excluded">{{ text }}</p>
    <p v-if="!period" class="scope-hint">
      {{
        confirmed
          ? '历史确认记录未保存入职日期，请核对原确认依据；需要重核时可撤销确认。'
          : '入职日期缺失，请先核对员工档案，不能将缺失信息视为整月在职。'
      }}
    </p>
    <p class="scope-hint">
      入职前、离职后的日期不计缺卡和缺拜访。在职期间仍按工作日历、保护期及已登记的免考核时段计算；底薪及补助按薪资规则折算。
    </p>
  </section>
</template>

<style scoped>
.employment-period {
  margin: 16px 0;
  padding: 14px 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  line-height: 1.6;
}
.employment-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
}
.scope-hint {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
}
.excluded {
  margin: 8px 0 0;
  color: var(--el-color-primary);
}
</style>
