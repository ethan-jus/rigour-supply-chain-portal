<template>
  <section v-if="form.personalPolicy">
    <el-divider content-position="left">试用期底薪设置</el-divider>
    <div class="scheme-grid">
      <el-form-item label="试用期底薪发放比例（%）" :required="!!policy.probationUntil">
        <el-input-number
          v-model="policy.probationBasePercent"
          :min="0"
          :max="100"
          :precision="2"
          :disabled="disabled"
          aria-label="试用期底薪发放比例"
        />
        <p class="field-hint">
          比例可配置：100%表示底薪不打折，80%表示按八折计发。仅影响底薪，绩效仍按绩效规则考核；出勤折算另按考勤结果执行。
        </p>
      </el-form-item>
      <el-form-item label="试用期结束后底薪发放比例（%）" :required="!!policy.probationUntil">
        <el-input-number
          v-model="postProbationPercent"
          :min="0"
          :max="100"
          :precision="2"
          :disabled="disabled"
          aria-label="试用期结束后底薪发放比例"
        />
        <p class="field-hint">
          结束当天起使用此比例，可按实际约定修改；原有配置未填写时按100%计发。
        </p>
      </el-form-item>
      <el-form-item label="试用期结束后首日">
        <el-date-picker
          v-model="policy.probationUntil"
          value-format="YYYY-MM-DD"
          placeholder="当天起使用结束后的底薪比例"
          :disabled="disabled"
          aria-label="试用期结束后首日"
        />
        <p class="field-hint">
          填入日期后，之前使用试用期比例，当天起使用结束后比例；留空不启用试用期折算。
        </p>
      </el-form-item>
    </div>
    <el-divider content-position="left">个人薪资与考核安排</el-divider>
    <el-form-item label="关联补贴方案">
      <el-select
        :model-value="activeSelection"
        @update:model-value="policy.allowanceVersionId = $event || null"
        clearable
        filterable
        :loading="loading || employmentLoading"
        :disabled="disabled || (!!employeeCode && (employmentLoading || !!employmentIssue))"
        placeholder="未单独关联时，沿用适用的部门补贴规则"
      >
        <el-option v-for="plan in plans" :key="plan.id" :value="plan.id" :label="planLabel(plan)" />
      </el-select>
      <p v-if="policy.allowanceVersionId && !activeSelection" class="field-hint">
        已关联：{{ historicalSelection }}。当前条件下不可选用，请核对身份、任职部门和生效月份。
        <el-button v-if="!disabled" link type="primary" @click="policy.allowanceVersionId = null"
          >清除历史关联</el-button
        >
      </p>
      <p v-if="employeeCode && employmentIssue" class="field-hint" role="alert">
        {{ employmentIssue }}
      </p>
      <p
        v-else-if="employeeCode && !loading && !employmentLoading && !plans.length"
        class="field-hint"
      >
        该员工在所选生效月份暂无可关联的补贴方案，请先维护适用补贴规则，或留空沿用部门规则。
      </p>
      <p class="field-hint">
        关联方案替代部门补贴，不重复累加。750元可维护为一个固定补贴项，也可由交通、话费、电脑补贴合计组成。
      </p>
      <p v-if="error" role="alert">{{ error }}</p>
    </el-form-item>
    <div v-if="isManager" class="scheme-grid">
      <el-form-item label="个人保护期结束后首日">
        <el-date-picker
          v-model="policy.protectionUntil"
          value-format="YYYY-MM-DD"
          placeholder="留空沿用入职日起一个日历月等部门规则"
        />
      </el-form-item>
    </div>
    <template v-if="form.baseSalary.mode === 'FIXED'">
      <el-divider content-position="left">月内薪资调整</el-divider>
      <p class="field-hint">
        用于见习转正式等个人调整。调整前取上方薪资标准，生效日起取下方金额；按已选自然日或工作日分别计算后合计。保护期内外同步分别计算。
      </p>
      <div class="scheme-grid">
        <el-form-item label="调整生效日期"
          ><el-date-picker v-model="policy.salaryChangeDate" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item v-if="policy.salaryChangeDate" label="调整后底薪（元/月）" required
          ><el-input-number v-model="policy.baseAfterChange" :min="0" :precision="2"
        /></el-form-item>
        <el-form-item v-if="policy.salaryChangeDate" label="调整后绩效基数（元/月）" required
          ><el-input-number v-model="policy.performanceAfterChange" :min="0" :precision="2"
        /></el-form-item>
      </div>
    </template>
    <el-divider content-position="left">个人打卡拜访免考核日期</el-divider>
    <p class="field-hint">
      点击标记活动报备、个人特殊安排等免考核日期。仅免除对应日期的打卡拜访任务；出勤天数、底薪和请假扣款由考勤确认核定。
    </p>
    <HrDateCalendar
      v-model="policy.exemptDays"
      :disabled="disabled"
      label="个人免考核日历"
      selected-text="免考核"
      unselected-text="按规则考核"
    />
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'
import { getPayrollComponents } from '@/api/core/payroll-scheme/components'
import { errorMessage } from '@/api/core/error'
import { componentVersionState } from '@/utils/payroll-component-versions'
import { businessDate, businessMonthRange } from '@/utils/business-date'
import {
  getHrEmployees,
  hrOrganizationApi,
  type HrAssignment,
  type HrEmployeeRecord,
} from '@/api/core/hr'
import HrDateCalendar from './HrDateCalendar.vue'
const props = defineProps<{ disabled?: boolean; employeeCode?: string }>()
const form = defineModel<PayrollSchemeDefinition>({ required: true })
if (!props.disabled)
  form.value.personalPolicy ??= {
    exemptDays: [],
    allowanceVersionId: null,
    probationUntil: null,
    probationBasePercent: form.value.role === 'SALES' ? 100 : 80,
    postProbationBasePercent: 100,
    protectionUntil: null,
    salaryChangeDate: null,
    baseAfterChange: null,
    performanceAfterChange: null,
  }
const policy = computed(() => form.value.personalPolicy!)
const postProbationPercent = computed({
  get: () => policy.value.postProbationBasePercent ?? 100,
  set: (value: number | undefined | null) => {
    policy.value.postProbationBasePercent = value ?? null
  },
})
const isManager = computed(() => ['CITY_MANAGER', 'TRAINEE_MANAGER'].includes(form.value.role))
const options = ref<PayrollComponentVersionView[]>([]),
  loading = ref(false),
  error = ref('')
const employee = ref<HrEmployeeRecord | null>(null)
const assignments = ref<HrAssignment[]>([])
const employmentLoading = ref(false)
const employmentError = ref('')
let employmentRequest = 0
watch(
  () => props.employeeCode,
  async (code) => {
    const request = ++employmentRequest
    employee.value = null
    assignments.value = []
    employmentError.value = ''
    employmentLoading.value = !!code
    if (!code) return
    try {
      const page = await getHrEmployees({ begin: 0, step: 2, employeeCode: code })
      // 同名离职档案不能代替本次选中的员工编号。
      const matches = page.items.filter((row) => row.employeeCode === code)
      if (matches.length !== 1) throw new Error('无法唯一定位当前员工档案，请刷新后重试')
      const current = matches[0]!
      const history = await hrOrganizationApi.assignments(current.id)
      if (current.entryDate) businessDate(current.entryDate)
      for (const assignment of history) {
        businessDate(assignment.effectiveFrom)
        if (assignment.effectiveTo) businessDate(assignment.effectiveTo)
      }
      if (request !== employmentRequest) return
      employee.value = current
      assignments.value = history
    } catch (e) {
      if (request === employmentRequest)
        employmentError.value = errorMessage(e, '员工任职记录加载失败，请重试')
    } finally {
      if (request === employmentRequest) employmentLoading.value = false
    }
  },
  { immediate: true },
)
const salaryMonth = computed(() =>
  /^\d{4}-\d{2}-01$/.test(form.value.effectiveFrom) ? form.value.effectiveFrom : '',
)
const assignmentDate = computed(() => {
  if (!salaryMonth.value) return ''
  const entry = employee.value?.entryDate ? businessDate(employee.value.entryDate) : null
  if (!entry || entry <= salaryMonth.value) return salaryMonth.value
  return entry <= businessMonthRange(salaryMonth.value.slice(0, 7))[1] ? entry : ''
})
const matchingAssignments = computed(() =>
  assignmentDate.value
    ? assignments.value.filter(
        (row) =>
          businessDate(row.effectiveFrom) <= assignmentDate.value &&
          (!row.effectiveTo || businessDate(row.effectiveTo) >= assignmentDate.value),
      )
    : [],
)
const employmentIssue = computed(() => {
  if (!props.employeeCode || employmentLoading.value) return ''
  if (employmentError.value) return employmentError.value
  if (!salaryMonth.value) return '请先选择有效的薪资生效月份'
  if (!assignmentDate.value) return '薪资生效月份早于该员工档案的入职月份，请核对生效月份'
  if (matchingAssignments.value.length !== 1)
    return '该员工在薪资生效月份没有唯一有效的任职部门，请核对入职日期和任职记录'
  return ''
})
const plans = computed(() =>
  options.value.filter(
    (p) =>
      !p.deleted &&
      p.definition.role === form.value.role &&
      !!salaryMonth.value &&
      componentVersionState(p, options.value, salaryMonth.value) === '使用中' &&
      (!props.employeeCode ||
        (!employmentLoading.value &&
          !employmentIssue.value &&
          matchingAssignments.value.length === 1 &&
          p.definition.departmentIds.includes(matchingAssignments.value[0]!.departmentId))),
  ),
)
const activeSelection = computed(() =>
  plans.value.some((p) => p.id === policy.value.allowanceVersionId)
    ? policy.value.allowanceVersionId
    : null,
)
const historicalSelection = computed(() => {
  const plan = options.value.find((p) => p.id === policy.value.allowanceVersionId)
  return plan ? planLabel(plan) : '已关联的历史补贴版本'
})
function planLabel(plan: PayrollComponentVersionView) {
  const amount =
    plan.definition.allowance?.items.reduce((s, item) => s + (item.amount || 0), 0) || 0
  return `${plan.definition.name} · ${amount.toFixed(2)}元/月 · ${plan.definition.effectiveFrom}起 · v${plan.version}`
}
function validate() {
  if (!policy.value?.allowanceVersionId) return null
  if (loading.value || employmentLoading.value) return '正在核对关联补贴方案，请稍候再保存'
  if (error.value) return error.value
  if (employmentIssue.value) return employmentIssue.value
  return activeSelection.value
    ? null
    : '关联补贴方案不适用于当前身份、任职部门或生效月份，请重新选择或清除关联'
}
defineExpose({ validate })
onMounted(async () => {
  loading.value = true
  try {
    options.value = await getPayrollComponents('ALLOWANCE')
  } catch (e) {
    error.value = errorMessage(e, '补贴方案加载失败，请检查补贴规则查看权限')
  } finally {
    loading.value = false
  }
})
</script>
