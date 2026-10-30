<template>
  <el-alert
    v-if="form.role !== 'SALES'"
    title="按当前业务约定，城市总及总部人员不发销售固定补贴，保存空项目即可明确不发补贴。"
    type="info"
    :closable="false"
  />
  <section v-else class="allowance-items">
    <el-table :data="form.allowances" border
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
    >
    <div class="allowance-actions">
      <el-button @click="form.allowances.push({ code: randomId(), name: '', amount: null })"
        >增加补贴项目</el-button
      >
    </div>
    <div class="allowance-summary" role="status" aria-label="每月补贴汇总" aria-atomic="true">
      <div class="allowance-summary-label">
        <span>每月补贴合计</span>
        <span class="allowance-summary-caption">{{
          form.allowances.length ? `共 ${form.allowances.length} 项补贴` : '当前明确不发补贴。'
        }}</span>
      </div>
      <div class="allowance-summary-amount">
        <strong>{{ total.toFixed(2) }}</strong>
        <span>元/月</span>
      </div>
    </div>
  </section>
  <p v-if="form.role === 'SALES'" class="field-hint">
    销售底薪及补贴按已确认出勤折算，绩效不随出勤比例折减。
  </p>
  <el-form-item label="补贴折算"
    ><el-input v-if="form.role === 'SALES'" model-value="按已确认出勤" disabled />
    <el-select v-else v-model="form.proration.allowance"
      ><el-option
        v-for="option in prorationOptions"
        :key="option.value"
        v-bind="option" /></el-select
  ></el-form-item>
</template>
<script setup lang="ts">
import { randomId } from '@/utils/random-id'
import { computed } from 'vue'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'
import { prorationOptions } from '@/utils/payroll-scheme'
const form = defineModel<PayrollSchemeDefinition>({ required: true })
const total = computed(() => form.value.allowances.reduce((sum, a) => sum + (a.amount || 0), 0))
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.allowance-items {
  margin-bottom: $spacing-lg;
}

.allowance-actions {
  margin: $spacing-md 0;
}

.allowance-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  padding: $spacing-md $spacing-lg;
  border: 1px solid var(--el-color-primary-light-8);
  border-radius: $border-radius-base;
  background: var(--el-color-primary-light-9);
}

.allowance-summary-label {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  color: $color-text-regular;
  font-size: var(--app-font-size-base);
  font-weight: 500;
}

.allowance-summary-caption {
  color: $color-text-secondary;
  font-size: var(--app-font-size-base);
  font-weight: 400;
}

.allowance-summary-amount {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-end;
  gap: $spacing-sm;
  color: $color-text-secondary;
  font-size: var(--app-font-size-base);

  strong {
    color: $color-primary;
    font-size: 28px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
}

@media (max-width: 600px) {
  .allowance-summary {
    align-items: flex-start;
    flex-direction: column;
    padding: $spacing-md;
  }

  .allowance-summary-amount {
    justify-content: flex-start;
  }
}
</style>
