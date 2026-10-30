<template>
  <p class="field-hint">
    员工底薪、绩效、提成归入人力成本；同一费用已在报销或薪酬登记的，请勿重复录入。
  </p>
  <h3 class="cost-section-title">营销事项</h3>
  <div class="cost-field-grid">
    <el-form-item label="费用类型" required>
      <CostDictSelect v-model="form.typeCode" code="MARKETING_EXPENSE_TYPE" />
    </el-form-item>
    <el-form-item label="费用归属" required>
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
  <h3 class="cost-section-title">金额与负责人</h3>
  <CostRecordBasics
    v-model="form"
    date-label="费用日期"
    amount-label="费用金额（元）"
    :action="action"
  />
  <div class="cost-field-grid">
    <el-form-item label="费用负责人" required>
      <CostEntryMode v-model="employeeMode" label="费用负责人">
        <template #linked>
          <el-select
            v-model="form.ownerEmployeeCode"
            filterable
            clearable
            :loading="employeeLoading"
            placeholder="搜索并选择员工"
            @change="chooseEmployee"
          >
            <el-option
              v-if="form.ownerEmployeeCode && !selectedEmployee"
              :value="form.ownerEmployeeCode"
              :label="form.ownerName || '名称待核对'"
            />
            <el-option
              v-for="employee in employees"
              :key="employee.employeeCode"
              :value="employee.employeeCode"
              :label="[employee.employeeName, employee.departmentName].filter(Boolean).join(' · ')"
            />
            <template #empty>
              <div class="employee-empty" :role="employeeError ? 'alert' : 'status'">
                <span>{{ employeeLoading ? '正在加载…' : employeeError || '未找到匹配员工' }}</span>
                <el-button
                  v-if="employeeError"
                  link
                  type="primary"
                  @click="emit('reloadEmployees')"
                >
                  重新加载
                </el-button>
                <el-button
                  v-else-if="!employeeLoading"
                  link
                  type="primary"
                  @click="employeeMode = 'MANUAL'"
                  >手动填写费用负责人</el-button
                >
              </div>
            </template>
          </el-select>
          <span v-if="employeeError" role="alert" class="employee-error">
            {{ employeeError }}
            <el-button link type="primary" @click="emit('reloadEmployees')">重新加载</el-button>
          </span>
          <span v-else-if="selectedEmployee?.departmentName" class="field-hint">
            {{ selectedEmployee.departmentName }}
          </span>
        </template>
        <template #manual>
          <el-input v-model="form.ownerName" maxlength="120" placeholder="填写实际费用负责人姓名" />
        </template>
      </CostEntryMode>
    </el-form-item>
    <el-form-item label="收款方">
      <el-input v-model="form.payeeName" maxlength="200" placeholder="公司或个人名称（可选）" />
    </el-form-item>
  </div>
  <template v-if="form.marketing">
    <h3 class="cost-section-title">投放与合作信息</h3>
    <div class="cost-field-grid">
      <el-form-item label="投放渠道／平台"
        ><el-input
          v-model="form.marketing.channelName"
          maxlength="200"
          placeholder="如线下推广、广告平台或合作渠道"
      /></el-form-item>
      <el-form-item label="服务期间开始"
        ><el-date-picker v-model="form.marketing.serviceFrom" value-format="YYYY-MM-DD"
      /></el-form-item>
      <el-form-item label="服务期间截止"
        ><el-date-picker v-model="form.marketing.serviceTo" value-format="YYYY-MM-DD"
      /></el-form-item>
    </div>
  </template>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { CostCommand, CostEmployee } from '@/api/core/cost'
import CostCitySelect from './CostCitySelect.vue'
import CostRecordBasics from './CostRecordBasics.vue'
import CostDictSelect from './CostDictSelect.vue'
import CostEntryMode from './CostEntryMode.vue'
import { useCostEntryMode } from './use-cost-entry-mode'
const props = defineProps<{
  action: string
  employees: CostEmployee[]
  employeeLoading?: boolean
  employeeError?: string
}>()
const form = defineModel<CostCommand>({ required: true })
const emit = defineEmits<{
  city: []
  cities: [{ code: string; name: string }[]]
  reloadEmployees: []
}>()
const employeeMode = useCostEntryMode(form, {
  empty: { ownerEmployeeCode: null, ownerName: '', departmentId: null } as Pick<
    CostCommand,
    'ownerEmployeeCode' | 'ownerName' | 'departmentId'
  >,
  isLinked: (value) => !!value.ownerEmployeeCode,
  hasName: (value) => !!value.ownerName?.trim(),
  toManual: (value) => ({ ...value, ownerEmployeeCode: null, departmentId: null }),
})
const selectedEmployee = computed(() =>
  props.employees.find((employee) => employee.employeeCode === form.value.ownerEmployeeCode),
)
function chooseEmployee() {
  form.value.ownerEmployeeCode ||= null
  form.value.ownerName = selectedEmployee.value?.employeeName || ''
  form.value.departmentId = selectedEmployee.value?.departmentId ?? null
}
</script>
<style scoped>
.employee-empty {
  padding: 14px 20px;
  color: var(--el-text-color-secondary);
}
.employee-error {
  color: var(--el-color-danger);
  font-size: 12px;
}
</style>
