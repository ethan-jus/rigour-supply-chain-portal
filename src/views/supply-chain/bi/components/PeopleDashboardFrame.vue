<template>
  <main class="people-dashboard">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">BI · 人员与客户经营</p>
        <SupplyPageTitle>{{ title }}</SupplyPageTitle>
        <p class="scope-note">{{ description }}</p>
      </div>
      <el-button :loading="initializing" :disabled="!ready" @click="publish">更新显示</el-button>
    </header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <div v-loading="initializing" class="dashboard-filters">
      <label
        >统计期间（北京时间）<el-date-picker
          v-model="dates"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :clearable="false"
          :disabled="!ready"
          @change="publish"
      /></label>
      <label
        >城市<el-select
          v-model="region"
          filterable
          :disabled="!ready || (scope?.accessLevel !== 'TENANT' && regions.length < 2)"
          aria-label="城市筛选"
          @change="publish"
          ><el-option
            v-if="scope?.accessLevel === 'TENANT'"
            label="全部城市"
            value="__ALL__" /><el-option
            v-for="item in regions"
            :key="item.optionValue"
            :value="item.optionValue"
            :label="item.optionLabel" /></el-select
      ></label>
      <label
        >员工<el-select
          v-model="owner"
          filterable
          :disabled="!ready || scope?.accessLevel === 'SELF'"
          aria-label="员工筛选"
          @change="publish"
          ><el-option
            v-if="scope?.accessLevel !== 'SELF'"
            label="全部员工"
            value="__ALL__" /><el-option
            v-for="item in owners"
            :key="item.optionValue"
            :value="item.optionValue"
            :label="item.optionLabel" /></el-select
      ></label>
      <el-button :disabled="!ready" @click="reset">重置筛选</el-button>
    </div>
    <p v-if="scope" class="scope-note">
      当前权限：{{
        scope.accessLevel === 'TENANT'
          ? '全租户'
          : scope.accessLevel === 'CITY'
            ? '授权城市'
            : '本人'
      }}
      · 日期范围同时作用于图表和明细；最多选择三年。<span v-if="syncedAt"
        >快照：{{ snapshotTime(syncedAt) }}</span
      >
    </p>
    <slot v-if="ready" />
  </main>
</template>
<script setup lang="ts">
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { getBiEffectiveScope, type BiEffectiveScope } from '@/api/core/bi-access'
import { getSupplyDashboardFilterOptions, type SupplyDashboardFilterOptions } from '@/api/core/bi'
import type { EmployeeAnalyticsQuery } from '@/api/core/bi-employees'
import { snapshotTime } from '../use-people-dashboard'
const props = defineProps<{
  title: string
  description: string
  yearToDate?: boolean
  syncedAt?: string | null
}>()
const emit = defineEmits<{ change: [query: EmployeeAnalyticsQuery] }>()
const scope = ref<BiEffectiveScope | null>(null)
const options = ref<SupplyDashboardFilterOptions | null>(null)
const initializing = ref(true),
  ready = ref(false),
  error = ref(''),
  region = ref(''),
  owner = ref('')
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())
const defaultDates = (): [string, string] => [
  props.yearToDate ? `${today.slice(0, 4)}-01-01` : `${today.slice(0, 7)}-01`,
  today,
]
const dates = ref<[string, string]>(defaultDates())
const regions = computed(() =>
  (options.value?.regions || []).filter(
    (item) =>
      scope.value?.accessLevel === 'TENANT' || scope.value?.regionCodes.includes(item.optionValue),
  ),
)
const owners = computed(() => {
  const rows = options.value?.salesOwners || []
  return owner.value &&
    owner.value !== '__ALL__' &&
    !rows.some((r) => r.optionValue === owner.value)
    ? [{ optionValue: owner.value, optionLabel: owner.value, usageCount: 0 }, ...rows]
    : rows
})
function publish() {
  if (!ready.value || !dates.value?.[0] || !dates.value[1]) return
  emit('change', {
    from: `${dates.value[0]}T00:00:00+08:00`,
    to: `${dates.value[1]}T23:59:59.999999+08:00`,
    regionCode: region.value === '__ALL__' ? undefined : region.value || undefined,
    ownerStaffCode: owner.value === '__ALL__' ? undefined : owner.value || undefined,
  })
}
function reset() {
  dates.value = defaultDates()
  region.value =
    scope.value?.accessLevel === 'TENANT'
      ? '__ALL__'
      : scope.value?.defaultRegionCode || scope.value?.regionCodes[0] || ''
  owner.value =
    scope.value?.accessLevel === 'SELF'
      ? scope.value.ownerStaffCode || scope.value.defaultOwnerStaffCode || ''
      : '__ALL__'
  publish()
}
let disposed = false
onBeforeUnmount(() => {
  disposed = true
})
onMounted(async () => {
  try {
    const access = await getBiEffectiveScope()
    if (disposed) return
    if (access.accessLevel === 'DENIED') throw new Error(access.reason || '没有看板数据权限')
    scope.value = access
    const filters = await getSupplyDashboardFilterOptions()
    if (disposed) return
    options.value = filters
    ready.value = true
    reset()
  } catch (reason) {
    if (!disposed)
      error.value = reason instanceof Error ? reason.message : '筛选范围加载失败，请刷新页面重试'
  } finally {
    if (!disposed) initializing.value = false
  }
})
</script>
<style lang="scss" src="../people-dashboard.scss"></style>
