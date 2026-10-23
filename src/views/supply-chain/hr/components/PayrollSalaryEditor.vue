<template>
  <el-form label-position="top" :disabled="disabled">
    <div class="scheme-grid">
      <el-form-item label="薪资标准方式" required
        ><el-select v-model="form.baseSalary.mode"
          ><el-option label="固定底薪" value="FIXED" /><el-option
            label="按金银铜牌档位"
            value="TIERS" /></el-select
      ></el-form-item>
      <el-form-item v-if="form.baseSalary.mode === 'FIXED'" label="底薪（元/月）" required
        ><el-input-number v-model="form.baseSalary.fixedAmount" :min="0" :precision="2"
      /></el-form-item>
    </div>
    <template v-if="form.baseSalary.mode === 'TIERS'">
      <p class="field-hint">
        每个档位分别维护底薪和绩效基数，回款区间在绩效规则设置。系统按当月档位同时取两个金额，再计算绩效。
      </p>
      <el-table :data="form.baseSalary.tiers" border
        ><el-table-column prop="name" label="档位" /><el-table-column label="底薪（元/月）"
          ><template #default="{ row }"
            ><el-input-number
              v-model="row.amount"
              :min="0"
              :precision="2" /></template></el-table-column
        ><el-table-column label="绩效基数（元/月）"
          ><template #default="{ row }"
            ><el-input-number v-model="row.performanceBase" :min="0" :precision="2" /></template
        ></el-table-column>
        <el-table-column label="底薪＋满额绩效（元）"
          ><template #default="{ row }">{{
            row.amount == null || row.performanceBase == null
              ? '待填写'
              : (Number(row.amount) + Number(row.performanceBase)).toFixed(2)
          }}</template></el-table-column
        >
      </el-table>
      <el-form-item label="入职首个自然月薪资档位"
        ><el-select v-model="form.baseSalary.firstMonthTier"
          ><el-option
            v-for="tier in form.baseSalary.tiers"
            :key="tier.code"
            :label="tier.name"
            :value="tier.code" /></el-select
      ></el-form-item>
    </template>
    <template v-if="form.baseSalary.mode === 'FIXED'">
      <el-divider content-position="left">绩效基数</el-divider>
      <el-form-item label="月度绩效基数（元）" required
        ><el-input-number v-model="form.performanceBase" :min="0" :precision="2" /><span
          class="field-hint"
          >考核前的绩效金额，实际发放金额由绩效规则计算。</span
        ></el-form-item
      >
    </template>
    <el-divider content-position="left">入离职及出勤折算</el-divider>
    <div class="scheme-grid">
      <el-form-item v-for="item in fields" :key="item.key" :label="item.label"
        ><el-select v-model="form.proration[item.key]"
          ><el-option
            v-for="option in prorationOptions"
            :key="option.value"
            v-bind="option" /></el-select
      ></el-form-item>
    </div>
    <PayrollPersonalPolicyEditor v-model="form" :disabled="disabled" />
  </el-form>
</template>
<script setup lang="ts">
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
import PayrollPersonalPolicyEditor from './PayrollPersonalPolicyEditor.vue'
import { prorationOptions } from '@/utils/payroll-scheme'
defineProps<{ disabled?: boolean }>()
const form = defineModel<PayrollSchemeDefinition>({ required: true })
const fields = [
  { key: 'base', label: '底薪折算' },
  { key: 'performance', label: '绩效折算' },
] as const
</script>
