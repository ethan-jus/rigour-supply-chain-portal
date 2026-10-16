<template>
  <el-divider content-position="left">金银铜牌业绩区间</el-divider>
  <p class="field-hint">
    按当月整单付清订单回款基数确定等级；各档位底薪金额在员工档案维护。上下界必须连续，边界金额只能归入一个等级。
  </p>
  <el-table :data="grades" border>
    <el-table-column prop="name" label="等级" width="100" />
    <el-table-column label="回款下界（元）"
      ><template #default="{ row }"
        ><el-input-number v-model="row.lower" :min="0" :controls="false" /><el-checkbox
          v-model="row.lowerInclusive"
          >包含下界</el-checkbox
        ></template
      ></el-table-column
    >
    <el-table-column label="回款上界（空为无上限）"
      ><template #default="{ row }"
        ><el-input-number v-model="row.upper" :min="0" :controls="false" /><el-checkbox
          v-model="row.upperInclusive"
          >包含上界</el-checkbox
        ></template
      ></el-table-column
    >
  </el-table>
</template>
<script setup lang="ts">
import type { PayrollGradeBand } from '@/api/core/payroll-scheme/models/PayrollGradeBand'
const grades = defineModel<PayrollGradeBand[]>({ required: true })
</script>
