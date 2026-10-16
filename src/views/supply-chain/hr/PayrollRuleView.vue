<template>
  <section class="supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <SupplyPageTitle>城市总管理</SupplyPageTitle>
        <p>维护负责人、管辖城市和任期；薪资标准在各规则入口维护。</p>
      </div>
      <el-button v-if="can('hr:payroll-rule:write')" type="primary" @click="edit()"
        >新增任职</el-button
      >
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <CityManagerPanel
      ref="panel"
      assignment-only
      :employees="employees"
      :cities="cities"
      :can-write="can('hr:payroll-rule:write')"
      @edit="edit"
      @add-city="addCity"
    />
    <CityCommissionEditor
      ref="editor"
      assignment-only
      :employees="employees"
      :cities="cities"
      :can-write="can('hr:payroll-rule:write')"
      @saved="panel?.reload()"
    />
  </section>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  getPayrollEmployees,
  type PayrollEmployee,
  type PayrollRule,
  type PayrollRuleCommand,
} from '@/api/core/payroll'
import { getCostCities } from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
import { loadCostDictionaries } from '../cost/cost-dictionaries'
import CityManagerPanel from './components/CityManagerPanel.vue'
import CityCommissionEditor from './components/CityCommissionEditor.vue'
const { can } = useSupplyPermissions()
const employees = ref<PayrollEmployee[]>([]),
  cities = ref<{ code: string; name: string }[]>([]),
  error = ref('')
const panel = ref<InstanceType<typeof CityManagerPanel>>(),
  editor = ref<InstanceType<typeof CityCommissionEditor>>()
function blank(): PayrollRuleCommand {
  return {
    requestId: crypto.randomUUID(),
    revision: null,
    name: '',
    kindCode: 'CITY_MANAGER',
    employeeCode: null,
    departmentIds: [],
    cityCode: null,
    cityName: null,
    includeOwnSalesCommission: true,
    productId: null,
    productVariantId: null,
    productName: null,
    unitCode: null,
    categoryId: null,
    categoryName: null,
    groupCode: null,
    recipientRoleCode: 'CITY_MANAGER',
    methodCode: null,
    rate: null,
    amount: null,
    effectiveFrom: '',
    effectiveTo: '9999-12-31',
    enabled: true,
    remark: '',
    allowanceTypeCode: null,
    fixedAllowance: null,
    performancePolicy: null,
  }
}
function edit(row?: PayrollRule) {
  editor.value?.open(blank(), row)
}
function addCity(row: PayrollRule) {
  editor.value?.open(blank(), undefined, row.data.employeeCode || undefined)
}
onMounted(async () => {
  const values = await Promise.allSettled([
    getPayrollEmployees(true),
    getCostCities(),
    loadCostDictionaries(),
  ])
  if (values[0].status === 'fulfilled') employees.value = values[0].value
  if (values[1].status === 'fulfilled') cities.value = values[1].value
  const failure = values.find((v) => v.status === 'rejected')
  if (failure?.status === 'rejected') error.value = errorMessage(failure.reason, '任职选项加载失败')
})
</script>
<style scoped>
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
</style>
