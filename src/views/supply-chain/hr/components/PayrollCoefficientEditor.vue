<template>
  <el-table :data="steps" border>
    <el-table-column label="完成率下界（%）" min-width="155">
      <template #default="{ row }">
        <el-input-number
          :model-value="percent(row.lower)"
          :min="0"
          :precision="2"
          :controls="false"
          @update:model-value="row.lower = rate($event)"
        />
        <el-checkbox v-model="row.lowerInclusive">包含下界</el-checkbox>
      </template>
    </el-table-column>
    <el-table-column label="完成率上界（空为无上限）" min-width="180">
      <template #default="{ row }">
        <el-input-number
          :model-value="percent(row.upper)"
          :min="0"
          :precision="2"
          :controls="false"
          @update:model-value="row.upper = rate($event)"
        />
        <el-checkbox v-model="row.upperInclusive">包含上界</el-checkbox>
      </template>
    </el-table-column>
    <el-table-column label="系数取值方式" min-width="170">
      <template #default="{ row }"
        ><el-select v-model="row.mode"
          ><el-option value="LINEAR" label="实际完成率 × 下方系数" /><el-option
            value="FIXED"
            label="固定使用下方系数" /></el-select
      ></template>
    </el-table-column>
    <el-table-column label="计分系数" min-width="140">
      <template #default="{ row }"
        ><el-input-number v-model="row.coefficient" :min="0" :precision="4" :controls="false"
      /></template>
    </el-table-column>
    <el-table-column width="70"
      ><template #default="{ $index }"
        ><el-button link type="danger" @click="steps.splice($index, 1)">移除</el-button></template
      ></el-table-column
    >
  </el-table>
  <el-button
    @click="
      steps.push({
        lower: null,
        upper: null,
        lowerInclusive: false,
        upperInclusive: true,
        mode: 'FIXED',
        coefficient: null,
      })
    "
    >增加区间</el-button
  >
  <p class="field-hint">
    完成率区间须从0%连续覆盖至无上限，边界不能重叠。区间、取值方式和计分系数均由HR维护。
  </p>
</template>
<script setup lang="ts">
import type { PayrollMetricStep } from '@/api/core/payroll-scheme/models/PayrollMetricStep'
const steps = defineModel<PayrollMetricStep[]>({ required: true })
const percent = (value: number | null) =>
  value == null ? undefined : Number((value * 100).toFixed(4))
const rate = (value: number | undefined | null) => (value == null ? null : value / 100)
</script>
