<template>
  <el-table :data="items" :row-class-name="itemClass" border>
    <el-table-column prop="name" label="工资项目" width="190" />
    <el-table-column label="标准 / 基数（元）" width="150" align="right"
      ><template #default="{ row: item }">{{
        'standard' in item ? payrollMoney(item.standard) : '—'
      }}</template></el-table-column
    >
    <el-table-column label="扣减 / 调整（元）" width="150" align="right"
      ><template #default="{ row: item }">{{
        'change' in item ? payrollMoney(item.change) : '—'
      }}</template></el-table-column
    >
    <el-table-column label="本月金额（元）" width="150" align="right"
      ><template #default="{ row: item }"
        ><strong>{{ payrollMoney(item.amount) }}</strong></template
      ></el-table-column
    >
    <el-table-column prop="basis" label="计算依据" min-width="330" />
  </el-table>
  <p class="field-hint">
    应发工资 = 底薪 + 绩效 + 补贴 + 提成 + 补发补扣；应付工资 = 应发工资 − 其他扣款。扣减 /
    调整列表示本月金额与标准的差额（含折算），已体现在本月金额中，不重复扣除。实际发放来自发放登记。
  </p>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { PayrollRecord } from '@/api/core/payroll'
import type { PayrollSalaryItem } from '@/api/core/payroll/models/PayrollSalaryItem'
import { payrollSalaryItems } from '@/utils/payroll-salary-items'
import { payrollMoney } from '@/utils/payroll-workflow'
const props = defineProps<{ row: PayrollRecord }>()
const items = computed(() => payrollSalaryItems(props.row))
const itemClass = ({ row }: { row: PayrollSalaryItem }) => (row.total ? 'payslip-total' : '')
</script>
<style scoped>
:deep(.payslip-total td.el-table__cell) {
  background: var(--el-color-primary-light-9);
  font-weight: 600;
}
</style>
