<template>
  <el-dialog
    v-model="visible"
    :title="`生成月度薪酬 · ${month}`"
    width="min(980px, 96vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
  >
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <p class="hint">
      按员工薪资档案及当月考勤、绩效、补贴、提成规则计算。生成后逐人核对薪酬明细；已确认、已发放工资自动跳过。
    </p>
    <div class="preparation-summary">
      <el-date-picker
        :model-value="month"
        type="month"
        value-format="YYYY-MM"
        :clearable="false"
        :disabled="busy"
        aria-label="核算月份"
        @update:model-value="emit('update:month', $event)"
      />
      <el-select
        v-model="selectedDepartment"
        clearable
        :disabled="busy"
        placeholder="全部部门"
        aria-label="核算部门"
      >
        <el-option
          v-for="department in departmentOptions"
          :key="department.id"
          :value="department.id"
          :label="department.name"
        />
      </el-select>
      <el-select
        v-model="roleFilter"
        clearable
        :disabled="busy"
        placeholder="全部薪资类别"
        aria-label="核算薪资类别"
      >
        <el-option
          v-for="(label, value) in salaryRoles"
          :key="value"
          :label="label"
          :value="value"
        />
      </el-select>
      <el-input
        v-model="search"
        placeholder="员工姓名／编号"
        clearable
        :disabled="busy"
        style="width: 220px"
      />
      <el-select v-model="filter" :disabled="busy" style="width: 150px"
        ><el-option label="全部员工" value="all" /><el-option
          label="尚未生成"
          value="uncalculated" /><el-option label="可生成／重算" value="eligible"
      /></el-select>
      <el-button :disabled="busy || loading" @click="selectEligible">选择筛选结果</el-button>
      <el-button :disabled="busy || !selected.length" @click="table?.clearSelection()"
        >清空选择</el-button
      >
      <el-checkbox v-model="onlySelected" :disabled="busy">仅看已选</el-checkbox>
      <span>已选 {{ selectedEligible.length }} 人</span>
    </div>
    <el-table
      ref="table"
      v-loading="loading"
      :data="filtered"
      row-key="employeeCode"
      max-height="420"
      border
      @selection-change="selected = $event"
    >
      <el-table-column
        type="selection"
        reserve-selection
        width="46"
        :selectable="(row: PayrollPreparationEmployee) => !busy && !row.locked"
      />
      <el-table-column label="员工" min-width="180"
        ><template #default="{ row }"
          >{{ row.employeeName }}
          <div class="hint">{{ row.employeeCode }}</div></template
        ></el-table-column
      >
      <el-table-column prop="departmentName" label="部门" min-width="130" />
      <el-table-column label="薪资类别" width="120"
        ><template #default="{ row }">{{
          salaryRoleLabel(row.payrollCategory)
        }}</template></el-table-column
      >
      <el-table-column label="当月工资" width="120"
        ><template #default="{ row }">{{
          row.payrollStatus ? costLabel('PAYROLL_STATUS', row.payrollStatus) : '尚未生成'
        }}</template></el-table-column
      >
      <el-table-column label="入职 / 离职日期" width="155">
        <template #default="{ row }">
          <div>入职：{{ row.entryDate || '未维护' }}</div>
          <div class="hint">离职：{{ row.leaveDate || '—' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="说明" min-width="200"
        ><template #default="{ row }">{{
          row.locked ? '已锁定，自动跳过' : row.profileIssues.join('；') || '按当月规则计算'
        }}</template></el-table-column
      >
    </el-table>
    <div v-if="busy || outcomes.length" aria-live="polite">
      <el-progress
        :percentage="progress"
        :status="busy ? undefined : outcomes.some((r) => r.failed) ? 'warning' : 'success'"
      />
      <p>
        已处理 {{ completed }}／{{ operationTotal }}
        人。每人工资独立保存；离开页面会停止后续处理，已生成结果保留，可从列表继续核对或重算。
      </p>
      <el-table :data="outcomes" max-height="210" border
        ><el-table-column prop="name" label="员工" width="140" /><el-table-column
          prop="message"
          label="生成结果"
      /></el-table>
    </div>
    <template #footer>
      <el-button v-if="busy" :disabled="stopRequested" @click="stopRequested = true"
        >停止后续生成</el-button
      >
      <el-button :disabled="busy" @click="visible = false">{{
        outcomes.length ? '查看工资列表' : '关闭'
      }}</el-button>
      <el-button
        v-if="can('hr:payroll:calculate')"
        type="primary"
        :loading="busy"
        :disabled="loading || !selectedEligible.length"
        @click="run()"
        >开始计算 {{ selectedEligible.length }} 人</el-button
      >
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { type TableInstance } from 'element-plus'
import { errorMessage } from '@/api/core/error'
import {
  getPayrollPreparation,
  calculatePayroll,
  type PayrollPreparationEmployee,
} from '@/api/core/payroll'
import { eligiblePayrollEmployees, runPayrollEmployees } from '@/utils/payroll-workflow'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { costLabel } from '../../cost/cost-dictionaries'
const salaryRoles: Record<string, string> = {
  SALES: '销售',
  CITY_MANAGER: '城市总',
  TRAINEE_MANAGER: '见习城市总',
  HEADQUARTERS: '总部',
}
const salaryRoleLabel = (role: string) => salaryRoles[role] || '档案待完善'
const props = defineProps<{ month: string; departmentId?: number }>()
const visible = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  changed: []
  loaded: [PayrollPreparationEmployee[]]
  'update:month': [string]
}>()
const { can } = useSupplyPermissions()
const rows = ref<PayrollPreparationEmployee[]>([]),
  selected = ref<PayrollPreparationEmployee[]>([])
const table = ref<TableInstance>(),
  loading = ref(false),
  error = ref(''),
  busy = ref(false),
  filter = ref('all'),
  search = ref('')
const selectedDepartment = ref(props.departmentId)
const roleFilter = ref('')
const onlySelected = ref(false)
const departmentOptions = computed(() => [
  ...new Map(
    rows.value
      .filter((e) => e.departmentId != null)
      .map((e) => [
        e.departmentId,
        { id: e.departmentId!, name: e.departmentName || String(e.departmentId) },
      ]),
  ).values(),
])
const scoped = computed(() =>
  rows.value.filter(
    (e) =>
      (!selectedDepartment.value || e.departmentId === selectedDepartment.value) &&
      (!roleFilter.value || e.payrollCategory === roleFilter.value),
  ),
)
const eligible = computed(() => eligiblePayrollEmployees(scoped.value))
const selectedEligible = computed(() => eligiblePayrollEmployees(selected.value))
const filtered = computed(() =>
  scoped.value.filter(
    (e) =>
      (!search.value || (e.employeeName + e.employeeCode).includes(search.value)) &&
      (!onlySelected.value ||
        selected.value.some((person) => person.employeeCode === e.employeeCode)) &&
      (filter.value === 'all' ||
        (filter.value === 'missing' && e.profileIssues.length) ||
        (filter.value === 'eligible' && eligible.value.includes(e)) ||
        (filter.value === 'uncalculated' &&
          (e.canCalculate ?? e.payrollCategory === 'SALES') &&
          !e.payrollStatus) ||
        (filter.value === 'rules' && e.ruleIssues.length)),
  ),
)
let version = 0
async function refresh() {
  const current = ++version
  loading.value = true
  error.value = ''
  try {
    const result = await getPayrollPreparation(props.month)
    if (current === version) {
      rows.value = result.employees
      emit('loaded', rows.value)
    }
  } catch (e) {
    if (current === version) {
      rows.value = []
      emit('loaded', [])
      error.value = errorMessage(e, '核算准备加载失败')
    }
  } finally {
    if (current === version) loading.value = false
  }
}
async function selectEligible() {
  const candidates = eligiblePayrollEmployees(filtered.value)
  await nextTick()
  for (const row of candidates) table.value?.toggleRowSelection(row, true)
}
const outcomes = ref<{ name: string; message: string; failed: boolean }[]>([]),
  completed = ref(0),
  operationTotal = ref(0)
const stopRequested = ref(false),
  disposed = ref(false)
onBeforeUnmount(() => {
  stopRequested.value = true
  disposed.value = true
})
const progress = computed(() =>
  operationTotal.value ? Math.round((completed.value / operationTotal.value) * 100) : 0,
)
async function run() {
  if (busy.value || !selectedEligible.value.length) return
  busy.value = true
  stopRequested.value = false
  outcomes.value = []
  completed.value = 0
  error.value = ''
  const people = [...selectedEligible.value],
    targetMonth = props.month
  operationTotal.value = people.length
  try {
    await runPayrollEmployees(
      people.map((e) => e.employeeCode),
      async (code) => {
        const name = people.find((e) => e.employeeCode === code)?.employeeName || code
        try {
          const result = await calculatePayroll(targetMonth, [code])
          outcomes.value.push({
            name,
            message: !result.length
              ? '状态已锁定，跳过'
              : result[0]!.statusCode === 'REVIEW'
                ? `已生成，${result[0]!.calculation.issues.length} 项依据待核定；请查看薪酬明细`
                : '核算完成，待确认',
            failed: false,
          })
        } catch (e) {
          outcomes.value.push({ name, message: errorMessage(e, '处理失败，请重试'), failed: true })
          throw e
        }
      },
      (done) => {
        completed.value = done
      },
      () => !stopRequested.value,
    )
    if (!disposed.value) {
      await refresh()
      emit('changed')
    }
  } finally {
    busy.value = false
  }
}
watch(
  () => props.month,
  () => {
    table.value?.clearSelection()
    selected.value = []
    outcomes.value = []
    void refresh()
  },
  { immediate: true },
)
watch(visible, (value) => {
  if (value) {
    selectedDepartment.value = props.departmentId
    void refresh()
  }
})
defineExpose({ refresh })
</script>
<style scoped>
.preparation-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0;
}
.hint {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
}
.el-alert {
  margin-bottom: 12px;
}
</style>
