<template>
  <div class="commission-rate">
    <el-select :model-value="rule.excluded ? 'NONE' : rule.method" @change="changeMethod">
      <el-option value="PERCENT" label="按回款比例" /><el-option
        value="QUANTITY"
        label="按数量"
      /><el-option value="NONE" label="明确不计提" />
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
        ><el-select v-model="rule.unitCode" filterable placeholder="单位"
          ><el-option
            v-for="unit in costOptions('PRODUCT_UNIT')"
            :key="unit.value"
            v-bind="unit" /></el-select
      ></template>
    </template>
  </div>
</template>
<script setup lang="ts">
import type { PayrollSchemeCommissionRule } from '@/api/core/payroll-scheme/models/PayrollSchemeCommissionRule'
import { costOptions } from '../../cost/cost-dictionaries'
const rule = defineModel<PayrollSchemeCommissionRule>({ required: true })
function changeMethod(value: string) {
  rule.value.excluded = value === 'NONE'
  if (value !== 'NONE') rule.value.method = value
}
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
