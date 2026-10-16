<template>
  <div class="cost-field-grid">
    <el-form-item v-if="month" label="费用月份" required>
      <el-date-picker v-model="form.costMonth" type="month" value-format="YYYY-MM" />
    </el-form-item>
    <el-form-item :label="dateLabel" required>
      <el-date-picker v-model="form.costDate" value-format="YYYY-MM-DD" />
    </el-form-item>
    <el-form-item v-if="showCity" label="归属城市" required>
      <CostCitySelect
        v-model="form.cityCode"
        :action="action"
        :snapshot="form.cityName"
        @loaded="emit('cities', $event)"
        @change="emit('city')"
      />
    </el-form-item>
    <el-form-item :label="amountLabel" :required="requiredAmount">
      <div class="full-width">
        <el-input-number
          v-model="form.amount"
          :min="0"
          :precision="2"
          :max="99999999999999.99"
          placeholder="待补金额"
          :controls="false"
        />
        <p v-if="!requiredAmount" class="field-hint">
          金额未知可留空保存；确认前补齐，零元需说明。
        </p>
      </div>
    </el-form-item>
  </div>
</template>
<script setup lang="ts">
import type { CostCommand } from '@/api/core/cost'
import CostCitySelect from './CostCitySelect.vue'
defineProps<{
  dateLabel: string
  amountLabel: string
  action: string
  showCity?: boolean
  month?: boolean
  requiredAmount?: boolean
}>()
const form = defineModel<CostCommand>({ required: true })
const emit = defineEmits<{ city: []; cities: [{ code: string; name: string }[]] }>()
</script>
