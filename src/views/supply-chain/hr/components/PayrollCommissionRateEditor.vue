<template>
  <div class="commission-rate">
    <el-select :model-value="rule.excluded ? 'NONE' : rule.method" @change="changeMethod">
      <el-option v-for="option in commissionMethodOptions" :key="option.value" v-bind="option" />
    </el-select>
    <template v-if="!rule.excluded">
      <el-input-number
        v-model="rule.value"
        :min="0"
        :max="rule.method === 'PERCENT' ? 100 : undefined"
        :precision="4"
        :controls="false"
        :aria-label="rule.recipientRole === 'SALES' ? '销售提成标准' : '城市总提成标准'"
      />
      <span v-if="rule.method === 'PERCENT'">%</span>
      <template v-else
        ><span>元／</span
        ><el-select
          v-model="rule.unitCode"
          filterable
          placeholder="计提单位"
          :aria-label="rule.recipientRole === 'SALES' ? '销售计提单位' : '城市总计提单位'"
          ><el-option v-for="unit in unitOptions" :key="unit.value" v-bind="unit" /></el-select
      ></template>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { commissionMethodOptions } from '@/utils/payroll-rule-options'
import type { PayrollSchemeCommissionRule } from '@/api/core/payroll-scheme/models/PayrollSchemeCommissionRule'
import { costOptions } from '../../cost/cost-dictionaries'
import { loadPayrollProductUnits, payrollUnitName } from '@/utils/payroll-dictionaries'
const rule = defineModel<PayrollSchemeCommissionRule>({ required: true })
const unitOptions = computed(() => {
  const options = costOptions('PRODUCT_UNIT')
  if (!rule.value.unitCode || options.some((unit) => unit.value === rule.value.unitCode))
    return options
  // Retain the label for a saved, disabled unit without offering it as a new selection.
  return [
    ...options,
    { value: rule.value.unitCode, label: payrollUnitName(rule.value.unitCode), disabled: true },
  ]
})
function changeMethod(value: string) {
  rule.value.excluded = value === 'NONE'
  if (value !== 'NONE') rule.value.method = value
}
onMounted(() => {
  void loadPayrollProductUnits()
})
</script>
<style scoped>
.commission-rate {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.commission-rate > .el-select:first-child {
  width: 100%;
}
.commission-rate .el-input-number {
  width: 105px;
}
.commission-rate > .el-select:last-child:not(:first-child) {
  width: 90px;
}
</style>
