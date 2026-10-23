<template>
  <section class="supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <SupplyPageTitle>城市总管理</SupplyPageTitle>
        <p>汇总员工档案中的管辖城市与任期；资料统一在员工档案维护。</p>
      </div>
      <el-button v-if="can('hr:employee:read')" @click="openEmployee()">前往员工档案</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <CityManagerPanel
      ref="panel"
      :employees="employees"
      :cities="cities"
      :can-open-employee="can('hr:employee:read')"
      @open-employee="openEmployee"
    />
  </section>
</template>
<script setup lang="ts">
import { ref, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { getPayrollEmployees, type PayrollEmployee } from '@/api/core/payroll'
import { getCostCities } from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
import CityManagerPanel from './components/CityManagerPanel.vue'
const { can } = useSupplyPermissions()
const router = useRouter()
const employees = ref<PayrollEmployee[]>([]),
  cities = ref<{ code: string; name: string }[]>([]),
  error = ref('')
const panel = ref<InstanceType<typeof CityManagerPanel>>()
function openEmployee(employeeCode?: string) {
  if (!can('hr:employee:read')) return
  void router.push({
    path: '/supply-chain/hr/employees',
    query: employeeCode ? { cityScopeEmployeeCode: employeeCode } : {},
  })
}
onMounted(async () => {
  const values = await Promise.allSettled([getPayrollEmployees(true), getCostCities()])
  if (values[0].status === 'fulfilled') employees.value = values[0].value
  if (values[1].status === 'fulfilled') cities.value = values[1].value
  const failure = values.find((v) => v.status === 'rejected')
  if (failure?.status === 'rejected') error.value = errorMessage(failure.reason, '任职选项加载失败')
})
// 页面被工作台缓存时，从档案返回后重新读取同一份管辖记录。
let activated = false
onActivated(() => {
  if (activated) void panel.value?.reload()
  activated = true
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
