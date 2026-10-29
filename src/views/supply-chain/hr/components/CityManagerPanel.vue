<template>
  <section class="city-manager-panel">
    <SupplyListFilters :loading="loading" @search="search" @reset="reset">
      <el-form-item label="城市总">
        <el-select
          v-model="managerFilter"
          aria-label="城市总筛选"
          filterable
          clearable
          placeholder="全部城市总"
        >
          <el-option
            v-for="item in managerOptions"
            :key="item.code"
            :value="item.code"
            :label="item.label"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="管辖城市">
        <el-select
          v-model="cityFilter"
          aria-label="管辖城市筛选"
          filterable
          clearable
          placeholder="全部城市"
        >
          <el-option
            v-for="item in cityOptions"
            :key="item.code"
            :value="item.code"
            :label="item.name"
          />
        </el-select>
      </el-form-item>
    </SupplyListFilters>
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <div class="manager-results">
      <span>共 {{ groups.length }} 位城市总</span>
      <el-button :loading="loading" @click="reload">刷新</el-button>
    </div>
    <div class="manager-list">
      <el-table
        v-loading="loading"
        :data="visibleGroups"
        row-key="employeeCode"
        height="100%"
        class="business-table"
        :empty-text="loadError ? '管辖范围加载失败，请刷新重试' : '暂无匹配的城市总'"
      >
        <el-table-column label="城市总" min-width="160" fixed="left">
          <template #default="{ row }"
            ><strong>{{ employeeName(row.employeeCode) }}</strong></template
          >
        </el-table-column>
        <el-table-column label="当前管辖城市" min-width="300">
          <template #default="{ row }">
            <SupplyScopeSummary
              v-if="row.cities.length"
              :items="cityNames(row.cities)"
              label="城市"
            />
            <span v-else class="muted">暂无在管城市</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="canOpenEmployee"
          label="操作"
          width="150"
          align="center"
          fixed="right"
        >
          <template #default="{ row }"
            ><el-button link type="primary" @click="$emit('openEmployee', row.employeeCode)"
              >查看员工档案</el-button
            ></template
          >
        </el-table-column>
      </el-table>
    </div>
    <el-pagination
      v-model:current-page="currentPage"
      :page-size="10"
      :total="groups.length"
      layout="prev, pager, next"
    />
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import SupplyScopeSummary from '@/components/supply/SupplyScopeSummary.vue'
import SupplyListFilters from '@/components/supply/SupplyListFilters.vue'
import { getPayrollRules, type PayrollRule, type PayrollEmployee } from '@/api/core/payroll'
import { errorMessage } from '@/api/core/error'
import { completePages, managerGroups, managerTermStatus } from '../city-manager-model'

const props = defineProps<{
  employees: PayrollEmployee[]
  cities: { code: string; name: string }[]
  canOpenEmployee: boolean
}>()
defineEmits<{
  openEmployee: [string]
}>()
const rules = ref<PayrollRule[]>([]),
  loading = ref(false),
  loadError = ref('')
const managerFilter = ref(''),
  cityFilter = ref(''),
  appliedManager = ref(''),
  appliedCity = ref(''),
  currentPage = ref(1)
let version = 0
const employeeName = (code: string) =>
  props.employees.find((e) => e.employeeCode === code)?.employeeName || code
const managerOptions = computed(() =>
  managerGroups(rules.value).map((g) => ({
    code: g.employeeCode,
    label: employeeName(g.employeeCode),
  })),
)
const cityOptions = computed(() => {
  const options = new Map(props.cities.map((c) => [c.code, c]))
  rules.value.forEach((r) => {
    if (r.data.cityCode && !options.has(r.data.cityCode))
      options.set(r.data.cityCode, {
        code: r.data.cityCode,
        name: r.data.cityName || r.data.cityCode,
      })
  })
  return [...options.values()]
})
const groups = computed(() =>
  managerGroups(rules.value, appliedManager.value)
    .map((group) => ({
      employeeCode: group.employeeCode,
      cities: [
        ...new Map(
          group.assignments
            .filter((row) => managerTermStatus(row) === '任期中' && row.data.cityCode)
            .map((row) => [
              row.data.cityCode!,
              { code: row.data.cityCode!, name: row.data.cityName || '城市名称未维护' },
            ]),
        ).values(),
      ],
    }))
    // 按城市筛选负责人，仍展示该负责人全部在管城市。
    .filter(
      (group) => !appliedCity.value || group.cities.some((city) => city.code === appliedCity.value),
    ),
)
const visibleGroups = computed(() =>
  groups.value.slice((currentPage.value - 1) * 10, currentPage.value * 10),
)
function cityNames(cities: { name: string }[]) {
  return cities.map((city) => city.name)
}
function search() {
  appliedManager.value = managerFilter.value
  appliedCity.value = cityFilter.value
  currentPage.value = 1
}
function reset() {
  managerFilter.value = ''
  cityFilter.value = ''
  search()
}
async function reload() {
  const id = ++version
  loading.value = true
  loadError.value = ''
  try {
    const all = await completePages((begin) =>
      getPayrollRules({ begin, step: 200, kindCode: 'CITY_MANAGER', keyword: '' }),
    )
    if (id !== version) return
    if (new Set(all.map((r) => r.id)).size !== all.length)
      throw new Error('管辖记录发生变化，请刷新后重试')
    rules.value = all
    currentPage.value = Math.min(
      currentPage.value,
      Math.max(1, Math.ceil(groups.value.length / 10)),
    )
  } catch (e) {
    if (id === version) {
      rules.value = []
      loadError.value = errorMessage(e, '管辖范围加载失败')
    }
  } finally {
    if (id === version) loading.value = false
  }
}
onMounted(reload)
onBeforeUnmount(() => {
  version++
})
defineExpose({ reload })
</script>
<style scoped>
.city-manager-panel {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
}
.manager-results {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.manager-results {
  flex-shrink: 0;
}
.manager-list {
  flex: 1;
  min-height: 220px;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.city-names {
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.muted {
  color: var(--el-text-color-regular);
  font-size: 13px;
}
.el-pagination {
  flex-shrink: 0;
  justify-content: flex-end;
}
</style>
