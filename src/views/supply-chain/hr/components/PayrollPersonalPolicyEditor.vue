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
        :loading="loading"
        :disabled="disabled"
        placeholder="未单独关联时，沿用适用的部门补贴规则"
      >
        <el-option v-for="plan in plans" :key="plan.id" :value="plan.id" :label="planLabel(plan)" />
      </el-select>
      <p v-if="policy.allowanceVersionId && !activeSelection" class="field-hint">
        历史关联：{{ historicalSelection }}。当前不可重新选用，可选择使用中的方案替换。
        <el-button v-if="!disabled" link type="primary" @click="policy.allowanceVersionId = null"
          >清除历史关联</el-button
        >
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
import { computed, onMounted, ref } from 'vue'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'
import { getPayrollComponents } from '@/api/core/payroll-scheme/components'
import { errorMessage } from '@/api/core/error'
import { componentVersionState } from '@/utils/payroll-component-versions'
import { businessDate } from '@/utils/business-date'
import HrDateCalendar from './HrDateCalendar.vue'
const props = defineProps<{ disabled?: boolean }>()
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
const plans = computed(() =>
  options.value.filter(
    (p) =>
      ['ALL', form.value.role].includes(p.definition.role) &&
      componentVersionState(p, options.value, businessDate(new Date())) === '使用中',
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
