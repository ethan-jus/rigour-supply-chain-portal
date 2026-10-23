<template>
  <section aria-label="只读试算结果" class="preview-results">
    <h3>试算结果 · {{ month }}</h3>
    <p class="hint">
      本次试算不保存工资。原已确认、已发放记录保持不变；金额有差异时由 HR 复核后撤销确认或登记补差。
    </p>
    <el-collapse>
      <el-collapse-item
        v-for="result in results"
        :key="result.employeeCode"
        :name="result.employeeCode"
      >
        <template #title>
          <span class="preview-title"
            >{{ result.employeeName }} · 应付 {{ payrollMoney(result.calculation.netPay) }} 元
            <el-tag :type="result.issues.length ? 'warning' : 'success'">{{
              result.issues.length ? `${result.issues.length} 项待核定` : '依据完整'
            }}</el-tag>
          </span>
        </template>
        <el-table :data="comparison(result)" border>
          <el-table-column prop="name" label="工资项目" min-width="100" />
          <el-table-column label="原保存金额（元）" align="right"
            ><template #default="{ row }">{{
              row.previous == null ? '—' : payrollMoney(row.previous)
            }}</template></el-table-column
          >
          <el-table-column label="本次试算（元）" align="right"
            ><template #default="{ row }">{{
              payrollMoney(row.current)
            }}</template></el-table-column
          >
          <el-table-column label="差额（元）" align="right"
            ><template #default="{ row }">{{
              row.previous == null || row.current == null
                ? '—'
                : payrollMoney(row.current - row.previous)
            }}</template></el-table-column
          >
        </el-table>
        <ul v-if="result.issues.length" class="preview-issues">
          <li v-for="issue in result.issues" :key="issue">{{ issue }}</li>
        </ul>
        <PayrollSchemeResult :row="record(result)" readonly />
      </el-collapse-item>
    </el-collapse>
  </section>
</template>
<script setup lang="ts">
import type { PayrollPreview, PayrollRecord, PayrollCalculation } from '@/api/core/payroll'
import { payrollMoney } from '@/utils/payroll-workflow'
import PayrollSchemeResult from './PayrollSchemeResult.vue'
const props = defineProps<{ results: PayrollPreview[]; month: string }>()
const fields: [keyof PayrollCalculation, string][] = [
  ['baseSalary', '底薪'],
  ['performance', '绩效'],
  ['allowance', '补贴'],
  ['commission', '提成'],
  ['correctionAmount', '补发补扣'],
  ['deduction', '其他扣款'],
  ['grossPay', '应发工资'],
  ['netPay', '应付工资'],
]
const comparison = (result: PayrollPreview) =>
  fields.map(([key, name]) => ({
    name,
    previous: result.previousCalculation?.[key] as number | null | undefined,
    current: result.calculation[key] as number | null | undefined,
  }))
const record = (result: PayrollPreview): PayrollRecord => ({
  id: '',
  month: props.month,
  employeeCode: result.employeeCode,
  employeeName: result.employeeName,
  departmentId: null,
  departmentName: null,
  cityName: null,
  statusCode: result.savedStatus || 'PREVIEW',
  revision: 0,
  calculation: result.calculation,
  updatedTime: '',
})
</script>
<style scoped>
.preview-results {
  margin-top: 20px;
}
.preview-title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.hint {
  color: var(--el-text-color-regular);
  line-height: 1.6;
}
.preview-issues {
  color: var(--el-color-warning-dark-2);
  line-height: 1.7;
  padding-left: 20px;
}
</style>
