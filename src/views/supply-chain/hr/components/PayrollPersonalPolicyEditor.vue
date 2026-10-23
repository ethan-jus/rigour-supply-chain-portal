<template>
  <section v-if="form.personalPolicy">
    <el-divider content-position="left">个人薪资与考核安排</el-divider>
    <el-form-item label="关联补贴方案">
      <el-select
        v-model="policy.allowanceVersionId"
        clearable
        filterable
        :loading="loading"
        :disabled="disabled"
        placeholder="未单独关联时，沿用适用的部门补贴规则"
      >
        <el-option
          v-if="policy.allowanceVersionId && !plans.some((p) => p.id === policy.allowanceVersionId)"
          :value="policy.allowanceVersionId"
          label="已关联历史补贴版本（当前列表不可用）"
          disabled
        />
        <el-option v-for="plan in plans" :key="plan.id" :value="plan.id" :label="planLabel(plan)" />
      </el-select>
      <p class="field-hint">
        关联方案替代部门补贴，不重复累加。750元可维护为一个固定补贴项，也可由交通、话费、电脑补贴合计组成。
      </p>
      <p v-if="error" role="alert">{{ error }}</p>
    </el-form-item>
    <div class="scheme-grid">
      <el-form-item label="试用期结束后首日">
        <el-date-picker
          v-model="policy.probationUntil"
          value-format="YYYY-MM-DD"
          placeholder="当天起恢复正常底薪"
        />
      </el-form-item>
      <el-form-item label="试用期底薪比例（%）">
        <el-input-number v-model="policy.probationBasePercent" :min="0" :max="100" :precision="2" />
        <p class="field-hint">
          仅折算底薪，绩效基数不打折。填写80表示底薪按八折计算，结束后首日起恢复正常底薪。
        </p>
      </el-form-item>
      <el-form-item v-if="isManager" label="个人保护期结束后首日">
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
import HrDateCalendar from './HrDateCalendar.vue'
const props = defineProps<{ disabled?: boolean }>()
const form = defineModel<PayrollSchemeDefinition>({ required: true })
if (!props.disabled)
  form.value.personalPolicy ??= {
    exemptDays: [],
    allowanceVersionId: null,
    probationUntil: null,
    probationBasePercent: 80,
    protectionUntil: null,
    salaryChangeDate: null,
    baseAfterChange: null,
    performanceAfterChange: null,
  }
const policy = computed(() => form.value.personalPolicy!)
const isManager = computed(() => ['CITY_MANAGER', 'TRAINEE_MANAGER'].includes(form.value.role))
const options = ref<PayrollComponentVersionView[]>([]),
  loading = ref(false),
  error = ref('')
const plans = computed(() =>
  options.value.filter((p) => ['ALL', form.value.role].includes(p.definition.role)),
)
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
