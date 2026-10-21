<template>
  <section class="city-manager-panel">
    <el-alert
      v-if="assignmentOnly"
      title="此处维护管辖城市和任期。工资与商品提成在对应规则入口维护；同一人管理多个城市，只生成一份月度工资。"
      type="info"
      :closable="false"
    />
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
      <el-form-item label="所辖城市">
        <el-select
          v-model="cityFilter"
          aria-label="所辖城市筛选"
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
      <span>匹配 {{ groups.length }} 位城市总 · {{ matchedRecords }} 条任职配置</span>
      <el-button :loading="loading" @click="reload">刷新</el-button>
    </div>
    <div v-loading="loading" class="manager-groups">
      <el-empty
        v-if="!loading && !loadError && !groups.length"
        description="暂无匹配的城市总任职配置"
      />
      <section v-for="group in visibleGroups" :key="group.employeeCode" class="manager-group">
        <header class="manager-group__heading">
          <div>
            <strong>{{ employeeName(group.employeeCode) }}</strong>
            <span class="muted manager-code">{{ group.employeeCode }}</span>
            <el-tag type="info"
              >{{ new Set(group.assignments.map((r) => r.data.cityCode)).size }} 个城市{{
                appliedCity ? '（筛选结果）' : ''
              }}</el-tag
            >
          </div>
          <div class="manager-actions">
            <el-button
              v-if="canWrite"
              type="primary"
              @click="$emit('addCity', group.assignments[0]!)"
              >增加管辖城市</el-button
            >
          </div>
        </header>
        <el-table :data="group.assignments" border row-key="id" class="business-table">
          <el-table-column prop="data.cityName" label="所辖城市" min-width="130" fixed="left" />
          <el-table-column prop="data.effectiveFrom" label="任期开始" width="115" />
          <el-table-column label="任期结束" width="125"
            ><template #default="{ row }">{{
              row.data.effectiveTo === '9999-12-31' ? '未设结束日期' : row.data.effectiveTo
            }}</template></el-table-column
          >
          <el-table-column label="任期状态" width="100"
            ><template #default="{ row }"
              ><el-tag
                :type="managerTermStatus(row as PayrollRule) === '任期中' ? 'success' : 'info'"
                >{{ managerTermStatus(row as PayrollRule) }}</el-tag
              ></template
            ></el-table-column
          >
          <el-table-column v-if="!assignmentOnly" label="本人销售提成" min-width="145"
            ><template #default="{ row }">{{
              row.data.includeOwnSalesCommission == null
                ? '待明确'
                : row.data.includeOwnSalesCommission
                  ? '另计销售提成'
                  : '不另计销售提成'
            }}</template></el-table-column
          >
          <el-table-column v-if="!assignmentOnly" label="团队计入比例" width="130"
            ><template #default="{ row }"
              >{{ row.data.cityCommission?.teamPercent ?? 100 }}%</template
            ></el-table-column
          >
          <el-table-column v-if="!assignmentOnly" label="独立商品提成" min-width="150"
            ><template #default="{ row }">{{
              row.data.cityCommission?.products == null
                ? '沿用部门商品标准'
                : row.data.cityCommission.products.length
                  ? row.data.cityCommission.products.length + ' 个商品型号'
                  : '不计提'
            }}</template></el-table-column
          >
          <el-table-column label="操作" width="90" fixed="right"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="$emit('edit', row as PayrollRule)">{{
                canWrite ? '编辑' : '查看'
              }}</el-button></template
            ></el-table-column
          >
        </el-table>
      </section>
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
import SupplyListFilters from '@/components/supply/SupplyListFilters.vue'
import { getPayrollRules, type PayrollRule, type PayrollEmployee } from '@/api/core/payroll'
import { errorMessage } from '@/api/core/error'
import { completePages, managerGroups, managerTermStatus } from '../city-manager-model'

const props = defineProps<{
  employees: PayrollEmployee[]
  cities: { code: string; name: string }[]
  canWrite: boolean
  assignmentOnly?: boolean
}>()
defineEmits<{
  edit: [PayrollRule]
  addCity: [PayrollRule]
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
    label: `${employeeName(g.employeeCode)} · ${g.employeeCode}`,
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
const groups = computed(() => managerGroups(rules.value, appliedManager.value, appliedCity.value))
const matchedRecords = computed(() => groups.value.reduce((n, g) => n + g.assignments.length, 0))
const visibleGroups = computed(() =>
  groups.value.slice((currentPage.value - 1) * 10, currentPage.value * 10),
)
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
      loadError.value = errorMessage(e, '提成配置加载失败')
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
.manager-results,
.manager-group__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.manager-results {
  flex-shrink: 0;
}
.manager-groups {
  flex: 1;
  min-height: 180px;
  overflow: auto;
}
.manager-group {
  padding: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  margin-bottom: 16px;
}
.manager-group__heading {
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.manager-code {
  margin: 0 12px;
  font-size: 13px;
}
.manager-actions {
  display: flex;
  gap: 8px;
}
.manager-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.muted {
  color: var(--el-text-color-regular);
  font-size: 13px;
}
.el-pagination {
  flex-shrink: 0;
  justify-content: flex-end;
}
@media (max-width: 640px) {
  .manager-group {
    padding: 12px;
  }
  .manager-group__heading > div:first-child {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .manager-code {
    margin: 0;
  }
}
</style>
