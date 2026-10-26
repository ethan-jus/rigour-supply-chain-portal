<template>
  <el-form label-position="top">
    <div class="scheme-grid">
      <el-form-item label="底薪计算方式"
        ><el-select v-model="form.baseSalary.mode"
          ><el-option label="按业绩档位" value="TIERS" /><el-option
            label="固定底薪"
            value="FIXED" /></el-select
      ></el-form-item>
      <el-form-item v-if="form.baseSalary.mode === 'FIXED'" label="固定底薪（元/月）" required
        ><el-input-number v-model="form.baseSalary.fixedAmount" :min="0" :precision="2"
      /></el-form-item>
      <el-form-item label="独立绩效基数（元/月）" required
        ><el-input-number v-model="form.performanceBase" :min="0" :precision="2"
      /></el-form-item>
    </div>
    <template v-if="form.baseSalary.mode === 'TIERS'">
      <p class="field-hint">
        系统用当月整单付清业绩匹配档位。底薪金额与绩效基数分别维护；上下界必须连续且只能归属一个档位。
      </p>
      <el-table :data="form.baseSalary.tiers" border>
        <el-table-column label="档位" min-width="115"
          ><template #default="{ row }"><el-input v-model="row.name" /></template
        ></el-table-column>
        <el-table-column label="下界（元）" min-width="155"
          ><template #default="{ row }"
            ><el-input-number v-model="row.lower" :min="0" :controls="false" /><el-checkbox
              v-model="row.lowerInclusive"
              >包含下界</el-checkbox
            ></template
          ></el-table-column
        >
        <el-table-column label="上界（留空无上限）" min-width="175"
          ><template #default="{ row }"
            ><el-input-number v-model="row.upper" :min="0" :controls="false" /><el-checkbox
              v-model="row.upperInclusive"
              >包含上界</el-checkbox
            ></template
          ></el-table-column
        >
        <el-table-column label="底薪（元）" min-width="155"
          ><template #default="{ row }"
            ><el-input-number
              v-model="row.amount"
              :min="0"
              :precision="2"
              :controls="false" /></template
        ></el-table-column>
        <el-table-column label="绩效基数（元）" min-width="155"
          ><template #default="{ row }"
            ><el-input-number v-model="row.performanceBase" :min="0" :precision="2" /></template
        ></el-table-column>
        <el-table-column label="操作" width="75"
          ><template #default="{ $index }"
            ><el-button link type="danger" @click="form.baseSalary.tiers.splice($index, 1)"
              >移除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-button
        @click="
          form.baseSalary.tiers.push({
            code: randomId(),
            name: '',
            lower: null,
            upper: null,
            lowerInclusive: true,
            upperInclusive: false,
            amount: null,
            performanceBase: null,
          })
        "
        >增加档位</el-button
      >
      <el-form-item label="入职首月底薪档位"
        ><el-select v-model="form.baseSalary.firstMonthTier"
          ><el-option
            v-for="tier in form.baseSalary.tiers"
            :key="tier.code"
            :label="tier.name || '未命名档位'"
            :value="tier.code" /></el-select
      ></el-form-item>
    </template>
    <el-divider content-position="left">补贴项目</el-divider>
    <el-alert
      v-if="form.role !== 'SALES' && form.allowances.length"
      title="当前业务约定城市总及总部不享受销售固定补贴，请核对适用项目。"
      type="warning"
      :closable="false"
    />
    <el-table v-if="form.role === 'SALES'" :data="form.allowances" border>
      <el-table-column label="项目"
        ><template #default="{ row }"><el-input v-model="row.name" /></template
      ></el-table-column>
      <el-table-column label="金额（元/月）"
        ><template #default="{ row }"
          ><el-input-number v-model="row.amount" :min="0" :precision="2" /></template
      ></el-table-column>
      <el-table-column label="操作" width="75"
        ><template #default="{ $index }"
          ><el-button link type="danger" @click="form.allowances.splice($index, 1)"
            >移除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-button
      v-if="form.role === 'SALES'"
      @click="form.allowances.push({ code: randomId(), name: '', amount: null })"
      >增加补贴</el-button
    >
    <el-divider content-position="left">入离职及出勤折算</el-divider>
    <div class="scheme-grid">
      <el-form-item v-for="item in prorationFields" :key="item.key" :label="item.label"
        ><el-select v-model="form.proration[item.key]"
          ><el-option
            v-for="option in prorationOptions"
            :key="option.value"
            v-bind="option" /></el-select
      ></el-form-item>
    </div>
    <p class="field-hint">
      折算分别作用于底薪、绩效和补贴；提成按订单核算。选择已确认出勤时，HR须先确认对应月份考勤。
    </p>
  </el-form>
</template>
<script setup lang="ts">
import { randomId } from '@/utils/random-id'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
import { prorationOptions } from '@/utils/payroll-scheme'
const form = defineModel<PayrollSchemeDefinition>({ required: true })
const prorationFields = [
  { key: 'base', label: '底薪折算' },
  { key: 'performance', label: '绩效折算' },
  { key: 'allowance', label: '补贴折算' },
] as const
</script>
