<template>
  <section v-if="eligible" class="employee-city-scope">
    <div class="scope-heading">
      <div>
        <h3>{{ employee.employeeName }} · 管辖城市与任期</h3>
        <p>岗位、入职及转正信息以员工资料为准。可同时管辖多个城市，各城市分别维护任期。</p>
      </div>
      <div class="scope-actions">
        <el-button :loading="loading" @click="reload">刷新</el-button>
        <el-button
          v-if="canEdit"
          type="primary"
          :disabled="loading || !!loadError"
          @click="$emit('edit')"
          >编辑管辖城市</el-button
        >
      </div>
    </div>
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <el-table
      v-loading="loading"
      :data="rules"
      border
      row-key="id"
      empty-text="尚未配置管辖城市"
      class="business-table"
    >
      <el-table-column prop="data.cityName" label="管辖城市" min-width="130" />
      <el-table-column prop="data.effectiveFrom" label="任期开始" width="120" />
      <el-table-column label="任期结束" min-width="130"
        ><template #default="{ row }">{{
          row.data.effectiveTo === '9999-12-31' ? '未设结束日期' : row.data.effectiveTo
        }}</template></el-table-column
      >
      <el-table-column label="任期状态" width="100"
        ><template #default="{ row }"
          ><el-tag
            :type="managerTermStatus(row as PayrollRule) === '任期中' ? 'success' : 'info'"
            >{{ managerTermStatus(row as PayrollRule) }}</el-tag
          ></template
        ></el-table-column
      >
      <el-table-column prop="data.remark" label="备注" min-width="160" show-overflow-tooltip />
    </el-table>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { HrEmployeeRecord } from '@/api/core/hr'
import { getPayrollRules, type PayrollRule } from '@/api/core/payroll'
import { errorMessage } from '@/api/core/error'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { isCityManagerPosition } from '@/utils/hr-payroll-profile'
import { completePages, managerTermStatus } from '../city-manager-model'

const props = defineProps<{ employee: HrEmployeeRecord }>()
defineEmits<{ edit: [] }>()
const { can } = useSupplyPermissions()
const eligible = computed(() => isCityManagerPosition(props.employee.positionName))
const canEdit = computed(
  () => eligible.value && can('hr:employee:update') && can('hr:payroll-rule:write'),
)
const rules = ref<PayrollRule[]>([])
const loading = ref(false),
  loadError = ref('')
let version = 0
async function reload() {
  const id = ++version,
    code = props.employee.employeeCode
  rules.value = []
  loadError.value = ''
  loading.value = false
  if (!eligible.value || !can('hr:payroll-rule:read')) return
  loading.value = true
  try {
    const records = await completePages((begin) =>
      getPayrollRules({ begin, step: 200, kindCode: 'CITY_MANAGER', keyword: '' }),
    )
    if (id !== version) return
    rules.value = records
      .filter((row) => row.data.kindCode === 'CITY_MANAGER' && row.data.employeeCode === code)
      .sort((a, b) => b.data.effectiveFrom.localeCompare(a.data.effectiveFrom))
  } catch (e) {
    if (id === version) loadError.value = errorMessage(e, '管辖范围加载失败，请重试')
  } finally {
    if (id === version) loading.value = false
  }
}
watch(() => [props.employee.employeeCode, props.employee.positionName], reload, { immediate: true })
onBeforeUnmount(() => {
  version++
})
</script>
<style scoped>
.employee-city-scope {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.scope-heading,
.scope-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.scope-heading {
  flex-wrap: wrap;
}
.scope-heading h3 {
  margin: 0 0 8px;
  font-size: 16px;
}
.scope-heading p {
  color: var(--el-text-color-regular);
  margin: 0;
  line-height: 1.7;
  font-size: 13px;
}
.scope-actions {
  flex-shrink: 0;
}
.scope-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
