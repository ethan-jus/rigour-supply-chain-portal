<template>
  <h3 class="cost-section-title">营销事项</h3>
  <div class="cost-field-grid">
    <el-form-item label="费用类型" required>
      <CostDictSelect v-model="form.typeCode" code="MARKETING_EXPENSE_TYPE" />
    </el-form-item>
    <el-form-item label="归属城市" required>
      <CostCitySelect
        v-model="form.cityCode"
        :action="action"
        :snapshot="form.cityName"
        @loaded="emit('cities', $event)"
        @change="emit('city')"
      />
    </el-form-item>
    <el-form-item label="费用事项" required class="cost-field-wide">
      <el-input v-model="form.title" maxlength="200" placeholder="填写具体活动或支出内容" />
    </el-form-item>
  </div>
  <h3 class="cost-section-title">金额与经办</h3>
  <CostRecordBasics
    v-model="form"
    date-label="费用日期"
    amount-label="费用金额（元）"
    :action="action"
  />
  <div class="cost-field-grid">
    <el-form-item label="经办人" required>
      <div class="full-width">
        <el-select
          v-model="form.ownerEmployeeCode"
          filterable
          clearable
          placeholder="选择已有员工；无档案可手填"
          @change="emit('employee')"
        >
          <el-option
            v-for="employee in employees"
            :key="employee.employeeCode"
            :value="employee.employeeCode"
            :label="`${employee.employeeName} · ${employee.employeeCode}${employee.departmentName ? ' · ' + employee.departmentName : ''}`"
          />
        </el-select>
        <el-input
          v-if="!form.ownerEmployeeCode"
          v-model="form.ownerName"
          maxlength="120"
          placeholder="手填实际经办人姓名"
          class="manual-name"
        />
        <p v-else class="field-hint">
          {{ selectedEmployee?.departmentName || '员工所属部门未提供' }}
        </p>
      </div>
    </el-form-item>
    <el-form-item label="收款方">
      <el-input v-model="form.payeeName" maxlength="200" placeholder="公司或个人名称（可选）" />
    </el-form-item>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { CostCommand, CostEmployee } from '@/api/core/cost'
import CostCitySelect from './CostCitySelect.vue'
import CostRecordBasics from './CostRecordBasics.vue'
import CostDictSelect from './CostDictSelect.vue'
const props = defineProps<{ action: string; employees: CostEmployee[] }>()
const form = defineModel<CostCommand>({ required: true })
const emit = defineEmits<{ city: []; cities: [{ code: string; name: string }[]]; employee: [] }>()
const selectedEmployee = computed(() =>
  props.employees.find((employee) => employee.employeeCode === form.value.ownerEmployeeCode),
)
</script>
<style scoped>
.manual-name {
  margin-top: 8px;
}
</style>
