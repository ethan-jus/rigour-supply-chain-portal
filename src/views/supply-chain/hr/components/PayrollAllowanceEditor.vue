<template>
  <el-alert
    v-if="form.role !== 'SALES'"
    title="按当前业务约定，城市总及总部人员不发销售固定补贴，保存空项目即可明确不发补贴。"
    type="info"
    :closable="false"
  />
  <template v-else
    ><el-table :data="form.allowances" border
      ><el-table-column label="补贴项目"
        ><template #default="{ row }"
          ><el-input v-model="row.name" maxlength="80" /></template></el-table-column
      ><el-table-column label="金额（元/月）"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.amount"
            :min="0"
            :precision="2" /></template></el-table-column
      ><el-table-column label="操作" width="80"
        ><template #default="{ $index }"
          ><el-button link type="danger" @click="form.allowances.splice($index, 1)"
            >移除</el-button
          ></template
        ></el-table-column
      ></el-table
    ><el-button @click="form.allowances.push({ code: crypto.randomUUID(), name: '', amount: null })"
      >增加补贴项目</el-button
    >
    <p>每月补贴合计：¥{{ total.toFixed(2) }}</p>
    <p v-if="!form.allowances.length" class="field-hint">当前明确不发补贴。</p></template
  >
  <el-form-item label="补贴折算"
    ><el-select v-model="form.proration.allowance"
      ><el-option
        v-for="option in prorationOptions"
        :key="option.value"
        v-bind="option" /></el-select
  ></el-form-item>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
import { prorationOptions } from '@/utils/payroll-scheme'
const form = defineModel<PayrollSchemeDefinition>({ required: true })
const total = computed(() => form.value.allowances.reduce((sum, a) => sum + (a.amount || 0), 0))
const crypto = globalThis.crypto
</script>
