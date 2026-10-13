<template>
  <el-card shadow="never" class="preparation-card">
    <div class="preparation-summary" aria-live="polite">
      <strong>核算准备 · {{ month }}</strong>
      <span>部门范围 {{ scoped.length }} 人</span><span>档案待完善 {{ missing }} 人</span
      ><span>可核算销售 {{ eligible.length }} 人</span
      ><span>规则需核对 {{ scoped.filter((e) => e.ruleIssues.length).length }} 人</span
      ><span>本次来源未检查 {{ unchecked }} 人</span> <span>销售未核算 {{ uncalculated }} 人</span
      ><span>已锁定 {{ scoped.filter((e) => e.locked).length }} 人</span>
      <el-button link type="primary" @click="open('missing')">完善档案</el-button>
      <el-button link type="primary" @click="open('all')">查看核算准备</el-button>
      <el-button link :loading="loading" @click="refresh">刷新</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <p class="hint">
      档案与规则检查仅为准备提示，订单回款、过程考核等来源需另行检查。总部暂不自动核算。
    </p>
  </el-card>
  <el-dialog
    v-model="visible"
    title="月度核算与档案准备"
    width="min(1120px, 96vw)"
    class="payroll-work-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
  >
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="preparation-summary">
      <strong>{{ month }} · {{ selected.length }} 人已选</strong>
      <el-select v-model="filter" aria-label="准备状态筛选" style="width: 180px" :disabled="busy">
        <el-option label="全部人员" value="all" /><el-option label="档案待完善" value="missing" />
        <el-option label="可核算销售" value="eligible" /><el-option
          label="销售未核算"
          value="uncalculated"
        />
        <el-option label="规则需核对" value="rules" />
      </el-select>
      <el-input
        v-model="search"
        clearable
        placeholder="员工姓名 / 编号"
        aria-label="准备员工搜索"
        style="width: 200px"
        :disabled="busy"
      />
      <el-button :disabled="busy || loading" @click="selectEligible"
        >选择部门全部可核算销售</el-button
      >
      <el-button
        v-if="can('hr:employee:update')"
        :disabled="busy || !selected.length || selected.length > 100"
        @click="openProfiles"
        >批量维护档案</el-button
      >
    </div>
    <el-alert
      v-if="!eligible.length && !loading"
      type="warning"
      :closable="false"
      title="当前范围没有可核算销售：请检查薪酬类别、任职月份及当月是否已确认。"
    >
      <el-button link type="primary" @click="filter = 'missing'">查看待完善档案</el-button>
      <router-link v-if="can('hr:employee:read')" to="/supply-chain/hr/employees?payrollMissing=1"
        >打开员工档案</router-link
      >
    </el-alert>
    <p class="hint">
      默认只核算销售；已确认、已发放人员自动跳过。选中的档案和规则缺项会进入待核对，可先检查来源。批量维护档案每次最多
      100 人。
    </p>
    <el-table
      ref="table"
      v-loading="loading"
      :data="filtered"
      row-key="employeeCode"
      max-height="400"
      border
      @selection-change="selected = $event"
    >
      <el-table-column type="selection" width="46" :selectable="() => !busy" />
      <el-table-column label="员工" min-width="140"
        ><template #default="{ row }"
          >{{ row.employeeName }}
          <div class="hint">{{ row.employeeCode }}</div></template
        ></el-table-column
      >
      <el-table-column prop="departmentName" label="部门" min-width="125" />
      <el-table-column label="薪酬类别" width="105"
        ><template #default="{ row }">{{
          row.payrollCategory === 'SALES'
            ? '销售'
            : row.payrollCategory === 'HEADQUARTERS'
              ? '总部'
              : '待完善'
        }}</template></el-table-column
      >
      <el-table-column label="当月状态" width="95"
        ><template #default="{ row }">{{
          row.payrollStatus ? costLabel('PAYROLL_STATUS', row.payrollStatus) : '未核算'
        }}</template></el-table-column
      >
      <el-table-column label="档案与规则提示" min-width="300"
        ><template #default="{ row }">
          <div v-for="issue in [...row.profileIssues, ...row.ruleIssues]" :key="issue">
            {{ issue }}
          </div>
          <span v-if="!row.profileIssues.length && !row.ruleIssues.length" class="hint">{{
            row.payrollCategory === 'HEADQUARTERS'
              ? '总部暂不自动核算'
              : '准备字段已齐，来源数据尚需检查'
          }}</span>
        </template></el-table-column
      >
      <el-table-column v-if="can('hr:employee:read')" label="处理" width="100"
        ><template #default="{ row }"
          ><el-button link type="primary" :disabled="busy" @click="editEmployee(row.employeeId)"
            >员工档案</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <div v-if="!busy && can('hr:payroll-rule:read')" class="preparation-summary">
      <router-link to="/supply-chain/hr/performance-rules">绩效规则</router-link
      ><router-link to="/supply-chain/hr/allowance-rules">其他薪资设置</router-link
      ><router-link to="/supply-chain/hr/commission-rules">商品提成规则</router-link>
    </div>
    <div v-if="busy || outcomes.length" aria-live="polite">
      <el-progress
        :percentage="progress"
        :status="busy ? undefined : outcomes.some((r) => r.failed) ? 'warning' : 'success'"
      />
      <p>
        {{ operationLabel }}：已处理 {{ completed }} / {{ operationTotal }} 人 ·
        {{
          busy
            ? stopRequested
              ? '正在完成当前人员后停止'
              : '正在处理，请勿关闭页面'
            : completed < operationTotal
              ? '已停止，剩余人员尚未处理'
              : '已完成；失败人员可重新选择处理'
        }}
      </p>
      <el-table :data="outcomes" max-height="210" border
        ><el-table-column prop="name" label="员工" width="150" /><el-table-column
          prop="message"
          label="结果"
      /></el-table>
    </div>
    <template #footer
      ><el-button v-if="busy" :disabled="stopRequested" @click="stopRequested = true"
        >停止后续处理</el-button
      ><el-button :disabled="busy" @click="visible = false">关闭</el-button
      ><el-button
        v-if="can('hr:payroll:calculate')"
        :disabled="busy || loading || !selectedEligible.length"
        @click="run(true)"
        >检查来源数据</el-button
      ><el-button
        v-if="can('hr:payroll:calculate')"
        type="primary"
        :loading="busy"
        :disabled="loading || !selectedEligible.length"
        @click="run(false)"
        >核算 {{ selectedEligible.length }} 名销售</el-button
      ></template
    >
  </el-dialog>
  <el-dialog
    v-model="profileVisible"
    title="批量完善薪酬档案"
    width="min(580px, 95vw)"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="!profileSaving"
    :show-close="!profileSaving"
  >
    <el-alert
      title="只更新下面明确填写的字段，留空保持原值。薪酬类别由 HR 确认，不按部门或岗位名称推断。"
      type="info"
      :closable="false"
    />
    <p>
      将更新所选 {{ selected.length }} 人：{{
        selected
          .slice(0, 8)
          .map((e) => e.employeeName)
          .join('、')
      }}{{ selected.length > 8 ? '…' : '' }}
    </p>
    <el-alert v-if="profileError" :title="profileError" type="error" :closable="false" />
    <el-form label-width="130px">
      <el-form-item label="薪酬类别"
        ><el-select v-model="patchCategory" clearable placeholder="保持原值"
          ><el-option label="销售" value="SALES" /><el-option
            label="总部"
            value="HEADQUARTERS" /></el-select
      ></el-form-item>
      <el-form-item label="是否转正"
        ><el-select v-model="patchRegularized" clearable placeholder="保持原值"
          ><el-option label="已转正" value="yes" /><el-option
            label="未转正"
            value="no" /></el-select
      ></el-form-item>
      <el-form-item v-if="patchRegularized === 'yes'" label="转正日期" required
        ><el-date-picker
          v-model="patchDate"
          type="date"
          value-format="YYYY-MM-DD"
          :disabled-date="futureDate"
      /></el-form-item>
      <el-form-item label="薪资生效日期"
        ><el-date-picker
          v-model="patchEffective"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="保持原值"
      /></el-form-item>
      <el-form-item label="试用期底薪（元）">
        <el-input v-model="patchProbationSalary" clearable placeholder="仅销售；留空保持原值" />
      </el-form-item>
      <el-form-item label="转正底薪（元）">
        <el-input v-model="patchRegularSalary" clearable placeholder="仅销售；留空保持原值" />
      </el-form-item>
      <el-form-item label="维护原因" required
        ><el-input v-model="patchReason" type="textarea" maxlength="500" show-word-limit
      /></el-form-item>
    </el-form>
    <template #footer
      ><el-button :disabled="profileSaving" @click="profileVisible = false">取消</el-button
      ><el-button type="primary" :loading="profileSaving" @click="saveProfiles"
        >确认更新 {{ selected.length }} 人</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type TableInstance } from 'element-plus'
import { errorMessage } from '@/api/core/error'
import {
  getPayrollPreparation,
  calculatePayroll,
  previewPayroll,
  updatePayrollProfiles,
  type PayrollPreparationEmployee,
} from '@/api/core/payroll'
import { eligiblePayrollEmployees, runPayrollEmployees } from '@/utils/payroll-workflow'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { costLabel } from '../../cost/cost-dictionaries'
const props = defineProps<{ month: string; departmentId?: number }>()
const visible = defineModel<boolean>({ default: false })
const emit = defineEmits<{ changed: []; loaded: [PayrollPreparationEmployee[]] }>()
const { can } = useSupplyPermissions(),
  router = useRouter()
const rows = ref<PayrollPreparationEmployee[]>([]),
  selected = ref<PayrollPreparationEmployee[]>([])
const table = ref<TableInstance>(),
  loading = ref(false),
  error = ref(''),
  busy = ref(false),
  filter = ref('all'),
  search = ref('')
const scoped = computed(() =>
  rows.value.filter((e) => !props.departmentId || e.departmentId === props.departmentId),
)
const missing = computed(() => scoped.value.filter((e) => e.profileIssues.length).length)
const uncalculated = computed(
  () => scoped.value.filter((e) => e.payrollCategory === 'SALES' && !e.payrollStatus).length,
)
const eligible = computed(() => eligiblePayrollEmployees(scoped.value))
const selectedEligible = computed(() => eligiblePayrollEmployees(selected.value))
const sourceChecked = ref<Record<string, number>>({})
const unchecked = computed(
  () => eligible.value.filter((e) => sourceChecked.value[e.employeeCode] !== e.revision).length,
)
const filtered = computed(() =>
  scoped.value.filter(
    (e) =>
      (!search.value || (e.employeeName + e.employeeCode).includes(search.value)) &&
      (filter.value === 'all' ||
        (filter.value === 'missing' && e.profileIssues.length) ||
        (filter.value === 'eligible' && eligible.value.includes(e)) ||
        (filter.value === 'uncalculated' && e.payrollCategory === 'SALES' && !e.payrollStatus) ||
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
function open(value: string) {
  filter.value = value
  visible.value = true
}
async function selectEligible() {
  filter.value = 'eligible'
  search.value = ''
  await nextTick()
  table.value?.clearSelection()
  for (const row of eligible.value) table.value?.toggleRowSelection(row, true)
}
function editEmployee(id: number) {
  void router.push({ path: '/supply-chain/hr/employees', query: { payrollEmployeeId: String(id) } })
}
const outcomes = ref<{ name: string; message: string; failed: boolean }[]>([]),
  completed = ref(0),
  operationTotal = ref(0),
  operationLabel = ref('')
const stopRequested = ref(false),
  disposed = ref(false)
onBeforeUnmount(() => {
  stopRequested.value = true
  disposed.value = true
})
const progress = computed(() =>
  operationTotal.value ? Math.round((completed.value / operationTotal.value) * 100) : 0,
)
async function run(preview: boolean) {
  if (busy.value || !selectedEligible.value.length) return
  busy.value = true
  stopRequested.value = false
  outcomes.value = []
  completed.value = 0
  error.value = ''
  operationLabel.value = preview ? '来源检查' : '月度核算'
  const people = [...selectedEligible.value],
    targetMonth = props.month
  operationTotal.value = people.length
  try {
    await runPayrollEmployees(
      people.map((e) => e.employeeCode),
      async (code) => {
        const name = people.find((e) => e.employeeCode === code)?.employeeName || code
        try {
          if (preview) {
            const result = await previewPayroll(targetMonth, [code])
            const issues = result[0]?.issues || []
            sourceChecked.value[code] = people.find((e) => e.employeeCode === code)!.revision
            outcomes.value.push({
              name,
              message: issues.length ? issues.join('；') : '当前来源检查通过；确认时将再次核对',
              failed: false,
            })
          } else {
            const result = await calculatePayroll(targetMonth, [code])
            sourceChecked.value[code] = people.find((e) => e.employeeCode === code)!.revision
            outcomes.value.push({
              name,
              message: !result.length
                ? '状态已锁定，跳过'
                : result[0]!.statusCode === 'REVIEW'
                  ? '待核对：' + result[0]!.calculation.issues.join('；')
                  : '核算完成，待确认',
              failed: false,
            })
          }
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
      if (!preview) emit('changed')
    }
  } finally {
    busy.value = false
  }
}
const profileVisible = ref(false),
  profileSaving = ref(false),
  profileError = ref(''),
  patchCategory = ref(''),
  patchRegularized = ref(''),
  patchDate = ref(''),
  patchEffective = ref(''),
  patchProbationSalary = ref(''),
  patchRegularSalary = ref(''),
  patchReason = ref('')
const futureDate = (date: Date) => date.getTime() > Date.now()
function openProfiles() {
  profileError.value = ''
  patchCategory.value = ''
  patchRegularized.value = ''
  patchDate.value = ''
  patchEffective.value = ''
  patchProbationSalary.value = ''
  patchRegularSalary.value = ''
  patchReason.value = ''
  profileVisible.value = true
}
async function saveProfiles() {
  profileError.value = ''
  if (
    !patchCategory.value &&
    !patchRegularized.value &&
    !patchEffective.value &&
    !patchProbationSalary.value.trim() &&
    !patchRegularSalary.value.trim()
  ) {
    profileError.value = '请至少填写一个需要更新的字段'
    return
  }
  if (!patchReason.value.trim() || (patchRegularized.value === 'yes' && !patchDate.value)) {
    profileError.value = '请填写维护原因及实际转正日期'
    return
  }
  const salaryValues = [patchProbationSalary.value.trim(), patchRegularSalary.value.trim()]
  if (salaryValues.some((value) => value && !/^[0-9]{1,14}([.][0-9]{1,2})?$/.test(value))) {
    profileError.value = '底薪须为非负金额，最多两位小数'
    return
  }
  if (
    salaryValues.some(Boolean) &&
    selected.value.some((e) => (patchCategory.value || e.payrollCategory) !== 'SALES')
  ) {
    profileError.value = '批量底薪维护仅适用于销售，请调整选择或薪酬类别'
    return
  }
  profileSaving.value = true
  try {
    await updatePayrollProfiles(
      selected.value.map((e) => ({
        employeeCode: e.employeeCode,
        revision: e.revision,
        payrollCategory: patchCategory.value || null,
        regularized: patchRegularized.value ? patchRegularized.value === 'yes' : null,
        regularizationDate: patchRegularized.value === 'yes' ? patchDate.value : null,
        salaryEffectiveFrom: patchEffective.value || null,
        probationSalary: patchProbationSalary.value.trim() || null,
        regularSalary: patchRegularSalary.value.trim() || null,
      })),
      patchReason.value.trim(),
    )
    profileVisible.value = false
    ElMessage.success('所选员工薪酬档案已更新')
    await refresh()
    emit('changed')
  } catch (e) {
    profileError.value = errorMessage(e, '批量维护失败，未保存本批更改')
  } finally {
    profileSaving.value = false
  }
}
watch(
  () => props.month,
  () => {
    selected.value = []
    outcomes.value = []
    sourceChecked.value = {}
    void refresh()
  },
  { immediate: true },
)
watch(visible, (value) => {
  if (value) void refresh()
})
defineExpose({ refresh })
</script>
<style scoped>
.preparation-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.hint {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
}
a {
  color: var(--el-color-primary);
  margin-right: 12px;
}
.el-alert {
  margin-bottom: 12px;
}
</style>
<style>
.payroll-work-dialog .el-dialog__body {
  max-height: 66vh;
  overflow: auto;
  padding-right: 12px;
}
.payroll-work-dialog .el-dialog__footer {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 14px;
}
</style>
