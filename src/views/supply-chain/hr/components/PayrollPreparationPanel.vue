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
      <el-checkbox
        v-if="formerRows.length || showFormer"
        :model-value="showFormer"
        :disabled="busy || loading"
        @change="(value) => changeRoster(value === true)"
        >离职结算</el-checkbox
      >
      <el-button :disabled="busy || loading || !visibleEligible.length" @click="selectEligible"
        >选择筛选结果</el-button
      >
      <el-button :disabled="busy || !selected.length" @click="clearSelection">清空选择</el-button>
      <el-checkbox v-model="onlySelected" :disabled="busy || !selected.length">仅看已选</el-checkbox>
      <span>已选 {{ selected.length }} 人</span>
    </div>
    <p v-if="showFormer" class="hint">逐人试算，确认有当月提成或历史更正后可生成结算记录。</p>
    <p class="preparation-counts" aria-live="polite">
      {{ showFormer ? '离职结算候选' : '本月人员' }} {{ roster.length }} 人 · 当前筛选
      {{ filtered.length }} 人 · 可生成
      {{ visibleEligible.length }} 人 · 档案待完善
      {{ filtered.filter((e) => e.profileIssues.length).length }} 人 · 规则待完善
      {{ filtered.filter((e) => e.ruleIssues.length).length }} 人
    </p>
    <el-table
      v-loading="loading"
      :data="filtered"
      row-key="employeeCode"
      max-height="420"
      border
    >
      <el-table-column width="46" align="center" fixed="left">
        <template #header>
          <el-checkbox
            aria-label="选择当前筛选中可生成的员工"
            :model-value="allVisibleSelected"
            :indeterminate="selected.length > 0 && !allVisibleSelected"
            :disabled="busy || loading || !visibleEligible.length"
            @change="(value) => (value ? selectEligible() : clearSelection())"
          />
        </template>
        <template #default="{ row }">
          <el-checkbox
            :aria-label="`选择 ${row.employeeName}（${row.employeeCode}）`"
            :model-value="selectedCodes.has(row.employeeCode)"
            :disabled="busy || loading || !eligibleCodes.has(row.employeeCode)"
            @change="(value) => toggleSelection(row.employeeCode, value === true)"
          />
        </template>
      </el-table-column>
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
            :disabled="busy || loading"
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
        :disabled="busy || loading || !selected.length"
        @click="run()"
        >开始计算 {{ selected.length }} 人</el-button
      >
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { displayBusinessLabel as costLabel } from '@/utils/business-display'
import { displayCell } from '@/utils/business-display'
import { departmentScopeTree } from '@/utils/hr-department-tree'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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
const rows = ref<PayrollPreparationEmployee[]>([])
const formerRows = ref<PayrollPreparationEmployee[]>([])
const showFormer = ref(false)
const verifiedFormerCodes = ref(new Set<string>())
const roster = computed(() => (showFormer.value ? formerRows.value : rows.value))
const selectedCodes = ref(new Set<string>())
const loading = ref(false),
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
    roster.value
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
  roster.value.filter(
    (e) =>
      (!selectedDepartment.value || e.departmentId === selectedDepartment.value) &&
      (!roleFilter.value || e.payrollCategory === roleFilter.value),
  ),
)
const eligibleCodes = computed(() => {
  const eligible = showFormer.value
    ? formerRows.value.filter((row) => !row.locked && verifiedFormerCodes.value.has(row.employeeCode))
    : eligiblePayrollEmployees(rows.value)
  return new Set(eligible.map((row) => row.employeeCode))
})
const matchingRows = computed(() =>
  scoped.value.filter(
    (e) =>
      (!employeeNameFilter.value.trim() ||
        e.employeeName.includes(employeeNameFilter.value.trim())) &&
      (!employeeCodeFilter.value.trim() || e.employeeCode.includes(employeeCodeFilter.value.trim())) &&
      (filter.value === 'all' ||
        (filter.value === 'missing' && e.profileIssues.length) ||
        (filter.value === 'eligible' && eligibleCodes.value.has(e.employeeCode)) ||
        (filter.value === 'uncalculated' && eligibleCodes.value.has(e.employeeCode) && !e.payrollStatus) ||
        (filter.value === 'rules' && e.ruleIssues.length)),
  ),
)
const matchingEligible = computed(() =>
  matchingRows.value.filter((row) => eligibleCodes.value.has(row.employeeCode)),
)
const selected = computed(() =>
  matchingEligible.value.filter((row) => selectedCodes.value.has(row.employeeCode)),
)
const filtered = computed(() => (onlySelected.value ? selected.value : matchingRows.value))
const visibleEligible = computed(() =>
  onlySelected.value ? selected.value : matchingEligible.value,
)
const allVisibleSelected = computed(
  () => visibleEligible.value.length > 0 && selected.value.length === visibleEligible.value.length,
)
watch(matchingEligible, (employees) => {
  const codes = new Set(employees.map((row) => row.employeeCode))
  selectedCodes.value = new Set([...selectedCodes.value].filter((code) => codes.has(code)))
  if (!selectedCodes.value.size) onlySelected.value = false
})

function clearSelection() {
  selectedCodes.value.clear()
  onlySelected.value = false
}
function toggleSelection(code: string, checked: boolean) {
  if (busy.value || loading.value) return
  if (checked && visibleEligible.value.some((row) => row.employeeCode === code))
    selectedCodes.value.add(code)
  else selectedCodes.value.delete(code)
  if (!selectedCodes.value.size) onlySelected.value = false
}
const previews = ref<PayrollPreview[]>([])
const operation = ref<'preview' | 'generate'>('generate')
function changeRoster(former: boolean) {
  showFormer.value = former
  clearSelection()
  previews.value = []
  outcomes.value = []
}
async function runPreview(people: PayrollPreparationEmployee[]) {
  if (busy.value || loading.value || !people.length) return
  busy.value = true
  operation.value = 'preview'
  error.value = ''
  previews.value = []
  stopRequested.value = false
  const targetMonth = props.month
  const rosterVersion = version
  try {
    await runPayrollEmployees(
      people.map((e) => e.employeeCode),
      async (code) => {
        try {
          const result = await previewPayroll(targetMonth, [code])
          if (disposed.value || targetMonth !== props.month || rosterVersion !== version) return
          previews.value.push(...result)
          if (showFormer.value) {
            if (result.some((item) => item.employeeCode === code && item.canGenerateFormerSettlement === true)) {
              verifiedFormerCodes.value.add(code)
            } else {
              verifiedFormerCodes.value.delete(code)
            }
          }
        } catch (e) {
          if (rosterVersion !== version) return
          verifiedFormerCodes.value.delete(code)
          error.value = `${people.find((person) => person.employeeCode === code)?.employeeName || code}：${errorMessage(e, '试算失败，可单独重试')}`
        }
      },
      () => {},
      () => !stopRequested.value && targetMonth === props.month,
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
  verifiedFormerCodes.value.clear()
  try {
    const result = await getPayrollPreparation(props.month)
    if (current === version) {
      rows.value = result.employees
      formerRows.value = result.formerEmployees ?? []
      emit('loaded', rows.value)
    }
  } catch (e) {
    if (current === version) {
      rows.value = []
      formerRows.value = []
      clearSelection()
      emit('loaded', [])
      error.value = errorMessage(e, '核算准备加载失败')
    }
  } finally {
    if (current === version) loading.value = false
  }
}
function selectEligible() {
  if (busy.value || loading.value) return
  selectedCodes.value = new Set(visibleEligible.value.map((row) => row.employeeCode))
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
  if (busy.value || loading.value || !selected.value.length) return
  busy.value = true
  operation.value = 'generate'
  stopRequested.value = false
  outcomes.value = []
  completed.value = 0
  error.value = ''
  const people = [...selected.value],
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
      () => !stopRequested.value && targetMonth === props.month,
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
    changeRoster(false)
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
  font-size: var(--app-font-size-base);
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
