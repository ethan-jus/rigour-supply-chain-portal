<template>
  <p class="field-hint">
    以下为生成本张工资单时实际使用的规则。历史订单采用的提成规则也在此列出，具体标准见提成明细。
  </p>
  <el-table :data="rules" border empty-text="历史工资快照尚未记录规则编码，请查看原规则记录">
    <el-table-column label="规则类型" width="110"
      ><template #default="{ row }">{{ kinds[row.kind] || row.kind }}</template></el-table-column
    >
    <el-table-column prop="ruleCode" label="规则编码" min-width="190" :formatter="displayCell" />
    <el-table-column prop="name" label="规则名称" min-width="240" :formatter="displayCell" />
    <el-table-column prop="effectiveFrom" label="生效日期" width="115" :formatter="displayCell" />
    <el-table-column label="结束日期" width="115"
      ><template #default="{ row }">{{
        row.effectiveTo === '9999-12-31' ? '长期有效' : row.effectiveTo
      }}</template></el-table-column
    >
  </el-table>
</template>
<script setup lang="ts">
import { displayCell } from '@/utils/business-display'
import { computed } from 'vue'
import type { PayrollRecord } from '@/api/core/payroll'
import { payrollAppliedRules } from '@/utils/payroll-commission-detail'
const props = defineProps<{ row: PayrollRecord }>()
const kinds: Record<string, string> = {
  SALARY: '薪资档案',
  PERFORMANCE: '绩效规则',
  ATTENDANCE: '考勤规则',
  ALLOWANCE: '补贴规则',
  COMMISSION: '提成规则',
}
const rules = computed(() => payrollAppliedRules(props.row))
</script>
