<template>
  <el-dialog
    v-model="visible"
    :title="`生成月度薪酬 · ${month}`"
    width="min(1180px, 96vw)"
    class="payroll-preparation-dialog business-detail-panel"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
  >
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <p class="hint">
      先检查档案和规则，再试算核对。试算不保存工资；生成后由 HR
      逐人核定、确认。已确认和已发放记录支持试算对比。
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
      <el-tree-select
        v-model="selectedDepartment"
        :data="departmentOptions"
        :props="{ label: 'name', children: 'children', disabled: 'disabled' }"
        node-key="id"
        check-strictly
        filterable
        default-expand-all
        clearable
        :disabled="busy"
        placeholder="全部部门"
        aria-label="核算部门"
      />
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
        v-model="employeeNameFilter"
        aria-label="准备员工姓名"
        placeholder="员工姓名"
        clearable
        :disabled="busy"
        style="width: 220px"
      />
      <el-input
        v-model="employeeCodeFilter"
        aria-label="准备员工编号"
        placeholder="员工编号"
        clearable
        :disabled="busy"
        style="width: 200px"
      />
      <el-select v-model="filter" :disabled="busy" style="width: 150px" aria-label="准备状态"
        ><el-option label="全部员工" value="all" /><el-option
          label="尚未生成"
          value="uncalculated" /><el-option label="可生成／重算" value="eligible" /><el-option
          label="档案待完善"
          value="missing" /><el-option label="规则待完善" value="rules"
      /></el-select>
      <el-button :disabled="busy || loading" @click="selectEligible">选择筛选结果</el-button>
      <el-button :disabled="busy || !selected.length" @click="table?.clearSelection()"
        >清空选择</el-button
      >
      <el-checkbox v-model="onlySelected" :disabled="busy">仅看已选</el-checkbox>
      <span>已选 {{ selectedEligible.length }} 人</span>
    </div>
    <p class="preparation-counts" aria-live="polite">
      本月人员 {{ scoped.length }} 人 · 可生成 {{ eligible.length }} 人 · 档案待完善
      {{ scoped.filter((e) => e.profileIssues.length).length }} 人 · 规则待完善
      {{ scoped.filter((e) => e.ruleIssues.length).length }} 人 · 当前筛选 {{ filtered.length }} 人
    </p>
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
      <el-table-column
        prop="employeeName"
        label="员工姓名"
        min-width="130"
        fixed="left"
        show-overflow-tooltip
        :formatter="displayCell"
      />
      <el-table-column
        prop="employeeCode"
        label="员工编号"
        min-width="170"
        show-overflow-tooltip
        :formatter="displayCell"
      />
      <el-table-column
        prop="departmentName"
        label="部门"
        min-width="130"
        :formatter="displayCell"
      />
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
      <el-table-column label="入职日期" width="125"
        ><template #default="{ row }">{{ row.entryDate || '-' }}</template></el-table-column
      >
      <el-table-column label="离职日期" width="125"
        ><template #default="{ row }">{{ row.leaveDate || '-' }}</template></el-table-column
      >
      <el-table-column label="说明" min-width="200"
        ><template #default="{ row }">{{
          [
            ...(row.locked ? ['已锁定，仅可试算对比'] : []),
            ...(row.leaveDate && row.leaveDate < month + '-01'
              ? ['离职后结算：仅提成及历史更正']
              : []),
            ...row.profileIssues,
            ...row.ruleIssues,
          ].join('；') || '档案与规则检查通过，业务依据以试算为准'
        }}</template></el-table-column
      >
      <el-table-column label="核对" width="100" fixed="right"
        ><template #default="{ row }"
          ><el-button
            v-if="can('hr:payroll:calculate')"
            link
            type="primary"
            :disabled="busy"
            @click="runPreview([row as PayrollPreparationEmployee])"
            >只读试算</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <PayrollPreviewResults v-if="previews.length" :results="previews" :month="month" />
    <div v-if="(busy && operation === 'generate') || outcomes.length" aria-live="polite">
      <el-progress
        :percentage="progress"
        :status="busy ? undefined : outcomes.some((r) => r.failed) ? 'warning' : 'success'"
      />
      <p>
        已处理 {{ completed }}／{{ operationTotal }}
        人。每人工资独立保存；离开页面会停止后续处理，已生成结果保留，可从列表继续核对或重算。
      </p>
      <el-table :data="outcomes" max-height="210" border
        ><el-table-column
          prop="name"
          label="员工"
          width="140"
          :formatter="displayCell" /><el-table-column
          prop="message"
          label="生成结果"
          :formatter="displayCell"
      /></el-table>
    </div>
    <template #footer>
      <el-button v-if="busy" :disabled="stopRequested" @click="stopRequested = true">{{
        operation === 'preview' ? '停止后续试算' : '停止后续生成'
      }}</el-button>
      <el-button :disabled="busy" @click="visible = false">{{
        outcomes.length ? '查看工资列表' : '关闭'
      }}</el-button>
      <el-button
        v-if="can('hr:payroll:calculate')"
        :disabled="busy || loading || !selected.length"
        @click="runPreview(selected)"
        >试算已选 {{ selected.length }} 人</el-button
      >
      <el-button
        v-if="can('hr:payroll:calculate')"
        type="primary"
        :loading="busy && operation === 'generate'"
        :disabled="loading || !selectedEligible.length"
        @click="run()"
        >开始计算 {{ selectedEligible.length }} 人</el-button
      >
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { displayBusinessLabel as costLabel } from '@/utils/business-display'
import { displayCell } from '@/utils/business-display'
import { departmentScopeTree } from '@/utils/hr-department-tree'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { type TableInstance } from 'element-plus'
import { errorMessage } from '@/api/core/error'
import {
  getPayrollPreparation,
  calculatePayroll,
  previewPayroll,
  type PayrollPreview,
  type PayrollPreparationEmployee,
} from '@/api/core/payroll'
import PayrollPreviewResults from './PayrollPreviewResults.vue'
import { eligiblePayrollEmployees, runPayrollEmployees } from '@/utils/payroll-workflow'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'

const salaryRoles: Record<string, string> = {
  SALES: '销售',
  CITY_MANAGER: '城市总',
  TRAINEE_MANAGER: '见习城市总',
  HEADQUARTERS: '总部',
}
const salaryRoleLabel = (role: string) => salaryRoles[role] || '档案待完善'
const props = withDefaults(
  defineProps<{
    month: string
    departmentId?: number
    departments?: import('@/api/core/payroll').PayrollDepartment[]
  }>(),
  { departments: () => [] },
)
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
  employeeNameFilter = ref(''),
  employeeCodeFilter = ref('')
const selectedDepartment = ref(props.departmentId)
const roleFilter = ref('')
const onlySelected = ref(false)
const employeeDepartments = computed(() => [
  ...new Map(
    rows.value
      .filter((e) => e.departmentId != null)
      .map((e) => [
        e.departmentId,
        { id: e.departmentId!, name: e.departmentName || String(e.departmentId) },
      ]),
  ).values(),
])
const departmentOptions = computed(() => {
  const rows = new Map(props.departments.map((department) => [department.id, department]))
  employeeDepartments.value.forEach((department) => {
    if (!rows.has(department.id))
      rows.set(department.id, { ...department, parentId: null, sortOrder: 0 })
  })
  const nodes = departmentScopeTree(
    [...rows.values()],
    employeeDepartments.value.map((department) => department.id),
  )
  const options = (branch: typeof nodes): ((typeof nodes)[number] & { disabled: boolean })[] =>
    branch.map((node) => ({ ...node, disabled: !node.selected, children: options(node.children) }))
  return options(nodes)
})
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
      (!employeeNameFilter.value.trim() ||
        e.employeeName.includes(employeeNameFilter.value.trim())) &&
      (!employeeCodeFilter.value.trim() ||
        e.employeeCode.includes(employeeCodeFilter.value.trim())) &&
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
const previews = ref<PayrollPreview[]>([])
const operation = ref<'preview' | 'generate'>('generate')
async function runPreview(people: PayrollPreparationEmployee[]) {
  if (busy.value || !people.length) return
  busy.value = true
  operation.value = 'preview'
  error.value = ''
  previews.value = []
  stopRequested.value = false
  const targetMonth = props.month
  try {
    await runPayrollEmployees(
      people.map((e) => e.employeeCode),
      async (code) => {
        try {
          const result = await previewPayroll(targetMonth, [code])
          if (!disposed.value && targetMonth === props.month) previews.value.push(...result)
        } catch (e) {
          error.value = `${people.find((person) => person.employeeCode === code)?.employeeName || code}：${errorMessage(e, '试算失败，可单独重试')}`
        }
      },
      () => {},
      () => !stopRequested.value,
    )
  } finally {
    busy.value = false
  }
}
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
  operation.value = 'generate'
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
    previews.value = []
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
.preparation-summary :deep(.el-select) {
  width: 180px;
}
.preparation-counts {
  color: var(--el-text-color-regular);
  line-height: 1.6;
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

<style>
.payroll-preparation-dialog {
  display: flex;
  flex-direction: column;
  max-height: 92vh;
}
.payroll-preparation-dialog .el-dialog__body {
  overflow: auto;
}
.payroll-preparation-dialog .el-dialog__header,
.payroll-preparation-dialog .el-dialog__footer {
  flex-shrink: 0;
}
</style>
