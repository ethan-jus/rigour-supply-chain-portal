<template>
  <div class="supply-page supply-page--business-main payroll-rule-page">
    <div class="page-heading">
      <div>
        <SupplyPageTitle>{{ commissionPage ? '提成设置' : title }}</SupplyPageTitle>
        <p>{{ description }}</p>
      </div>
      <el-button v-if="can('hr:payroll-rule:write')" type="primary" @click="edit()"
        >新增{{ title }}</el-button
      >
    </div>
    <el-tabs v-if="commissionPage" v-model="commissionTab" @tab-change="search"
      ><el-tab-pane name="COMMISSION" label="商品提成规则" /><el-tab-pane
        name="CITY_MANAGER"
        label="城市总提成归属"
    /></el-tabs>
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <el-card shadow="never" class="filter-card"
      ><el-form inline @submit.prevent="search"
        ><el-form-item label="规则名称"
          ><el-input
            v-model="keyword"
            placeholder="规则名称"
            clearable
            @keyup.enter="search" /></el-form-item
        ><el-form-item class="filter-actions"
          ><el-button type="primary" :loading="loading" @click="search">查询</el-button
          ><el-button @click="reset">重置</el-button></el-form-item
        ></el-form
      ></el-card
    >
    <div class="result-heading">
      <span>共 {{ page.total }} 条规则</span
      ><el-button :loading="loading" @click="load">刷新</el-button>
    </div>
    <el-card shadow="never" class="list-card"
      ><el-table
        v-loading="loading"
        :data="page.items"
        border
        row-key="id"
        class="business-table supply-scroll-table"
      >
        <el-table-column
          prop="data.name"
          label="规则名称"
          min-width="180"
          fixed="left"
          show-overflow-tooltip
        />
        <el-table-column v-if="kind === 'CITY_MANAGER'" label="员工" min-width="160"
          ><template #default="{ row }">{{
            employeeName(row.data.employeeCode)
          }}</template></el-table-column
        >
        <el-table-column
          v-if="kind !== 'CITY_MANAGER'"
          label="适用部门"
          min-width="190"
          show-overflow-tooltip
          ><template #default="{ row }">{{
            departmentNames(row.data.departmentIds)
          }}</template></el-table-column
        >
        <el-table-column
          v-if="kind === 'CITY_MANAGER'"
          prop="data.cityName"
          label="所辖城市"
          width="180"
        />
        <template v-if="kind === 'COMMISSION'"
          ><el-table-column label="商品组" min-width="170"
            ><template #default="{ row }">{{
              costLabel('COMMISSION_PRODUCT_GROUP', row.data.groupCode)
            }}</template></el-table-column
          ><el-table-column
            prop="data.productName"
            label="商品规格"
            min-width="190"
            show-overflow-tooltip
          /><el-table-column label="受益角色" width="120"
            ><template #default="{ row }">{{
              costLabel('COMMISSION_RECIPIENT_ROLE', row.data.recipientRoleCode)
            }}</template></el-table-column
          ><el-table-column label="提成标准" width="160" align="right"
            ><template #default="{ row }"
              >{{ row.data.rate
              }}{{
                row.data.methodCode === 'PERCENT'
                  ? '%'
                  : ' 元/' + costLabel('PRODUCT_UNIT', row.data.unitCode)
              }}</template
            ></el-table-column
          ></template
        >
        <el-table-column v-if="kind === 'ALLOWANCE'" label="类型" width="130">
          <template #default="{ row }">{{
            costLabel('PAYROLL_ALLOWANCE_TYPE', row.data.allowanceTypeCode)
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="kind !== 'CITY_MANAGER' && kind !== 'COMMISSION'"
          :label="kind === 'PERFORMANCE' ? '满额月绩效（元）' : '每月金额（元）'"
          align="right"
          width="160"
          ><template #default="{ row }">{{ costMoney(row.data.amount) }}</template></el-table-column
        >
        <el-table-column prop="data.effectiveFrom" label="生效日期" width="115" /><el-table-column
          label="截止日期"
          width="115"
          ><template #default="{ row }">{{
            row.data.effectiveTo === '9999-12-31' ? '长期有效' : row.data.effectiveTo
          }}</template></el-table-column
        >
        <el-table-column label="状态" width="85"
          ><template #default="{ row }"
            ><el-tag :type="row.data.enabled ? 'success' : 'info'">{{
              row.data.enabled ? '启用' : '停用'
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column
          prop="data.remark"
          label="备注"
          min-width="140"
          show-overflow-tooltip
        /><el-table-column label="操作" fixed="right" width="150"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="edit(row as PayrollRule)">{{
              can('hr:payroll-rule:write') ? '编辑' : '查看'
            }}</el-button
            ><el-button
              v-if="can('hr:payroll-rule:write')"
              link
              type="primary"
              @click="copyRule(row as PayrollRule)"
              >复制</el-button
            ></template
          ></el-table-column
        > </el-table
      ><el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="page.total"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="search"
    /></el-card>
    <el-dialog
      v-model="visible"
      :title="(editingId ? '编辑' : '新增') + title"
      width="min(800px, 96vw)"
      class="payroll-rule-dialog"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-alert v-if="editorError" :title="editorError" type="error" :closable="false" />
      <el-form label-width="120px" :disabled="!can('hr:payroll-rule:write')">
        <el-form-item label="规则名称" required
          ><el-input v-model="form.name" maxlength="120"
        /></el-form-item>
        <el-form-item v-if="kind === 'CITY_MANAGER'" label="城市总员工" required
          ><el-select v-model="form.employeeCode" filterable
            ><el-option
              v-for="e in employees.filter((item) => item.payrollCategory === 'SALES')"
              :key="e.employeeCode"
              :label="
                e.employeeName + ' · ' + e.employeeCode + ' · ' + (e.departmentName || '未分配部门')
              "
              :value="e.employeeCode" /></el-select
        ></el-form-item>
        <el-form-item v-if="kind !== 'CITY_MANAGER'" label="适用部门" required
          ><div class="full-width">
            <el-tree-select
              v-model="form.departmentIds"
              :data="departmentOptionsTree"
              node-key="id"
              :props="{ label: 'name', children: 'children' }"
              multiple
              show-checkbox
              check-strictly
              filterable
              clearable
              default-expand-all
              :render-after-expand="false"
              collapse-tags
              collapse-tags-tooltip
              :max-collapse-tags="3"
              placeholder="搜索并选择适用部门"
              aria-label="适用部门"
            />
            <p class="field-hint">
              <el-checkbox v-model="includeChildren">包含下级部门</el-checkbox><br />
              将保存 {{ coveredDepartments.length }} 个部门，当前销售档案
              {{ coveredEmployees }} 人。{{
                departmentNames(coveredDepartments) || '请先选择部门'
              }}。 包含下级会保存当前可见的下级部门；新建部门后请重新检查覆盖。
            </p>
          </div></el-form-item
        >
        <template v-if="kind === 'CITY_MANAGER'">
          <el-form-item label="所辖城市" required
            ><el-select
              v-model="form.cityCode"
              filterable
              @change="form.cityName = cities.find((c) => c.code === form.cityCode)?.name || ''"
              ><el-option
                v-for="city in cities"
                :key="city.code"
                :value="city.code"
                :label="city.name" /></el-select
          ></el-form-item>
          <el-form-item label="本人销售"
            ><el-checkbox v-model="form.includeOwnSalesCommission"
              >同时计销售人员提成</el-checkbox
            ></el-form-item
          >
          <el-alert
            title="城市总提成包含所辖城市全部销售；不勾选时，本人销售仅计城市总提成。"
            type="info"
            :closable="false"
          />
        </template>
        <template v-if="kind === 'COMMISSION'">
          <el-form-item label="商品组" required
            ><CostDictSelect
              v-model="form.groupCode"
              code="COMMISSION_PRODUCT_GROUP"
              @update:model-value="applyPolicy"
          /></el-form-item>
          <el-form-item label="受益角色" required
            ><CostDictSelect
              v-model="form.recipientRoleCode"
              code="COMMISSION_RECIPIENT_ROLE"
              @update:model-value="applyPolicy"
          /></el-form-item>
          <el-form-item label="商品规格" required
            ><div class="full-width">
              <el-select
                v-model="form.productVariantId"
                filterable
                remote
                :remote-method="searchProducts"
                :loading="productsLoading"
                placeholder="搜索商品名称、编码或规格，选择真实 SKU"
                @change="selectProduct"
                ><el-option
                  v-for="p in products"
                  :key="p.productVariantId"
                  :value="p.productVariantId"
                  :label="productLabel(p)"
              /></el-select>
              <p class="field-hint">
                商品组只提供可编辑的默认标准，绑定真实 SKU
                后参与核算。台呢按套计提，请核实所选规格单位。
              </p>
            </div></el-form-item
          >
          <el-form-item label="计算方式" required
            ><CostDictSelect
              v-model="form.methodCode"
              code="PAYROLL_COMMISSION_METHOD" /></el-form-item
          ><el-form-item
            :label="form.methodCode === 'PERCENT' ? '回款提成（%）' : '单位提成（元）'"
            required
            ><el-input-number
              v-model="form.rate"
              :min="0"
              :max="form.methodCode === 'PERCENT' ? 100 : 99999999999999.99"
              :precision="2"
            /><span class="field-hint">{{
              form.methodCode === 'QUANTITY' ? ' / ' + costLabel('PRODUCT_UNIT', form.unitCode) : ''
            }}</span></el-form-item
          >
          <el-alert
            title="整笔订单全部回款后发放；混合商品订单按明细金额分摊订单净回款，退款等异常进入待核对。"
            type="info"
            :closable="false"
          />
        </template>
        <template v-if="kind === 'ALLOWANCE'">
          <el-form-item label="类型" required>
            <CostDictSelect
              v-model="form.allowanceTypeCode"
              code="PAYROLL_ALLOWANCE_TYPE"
              @update:model-value="allowanceTypeChanged"
            />
          </el-form-item>
          <template v-if="form.allowanceTypeCode === 'FIXED_ALLOWANCE' && form.fixedAllowance">
            <el-form-item label="车辆 / 交通（元）"
              ><el-input-number
                v-model="form.fixedAllowance.vehicleAllowance"
                :min="0"
                :max="9999999999999.99"
                :precision="2"
            /></el-form-item>
            <el-form-item label="话费（元）"
              ><el-input-number
                v-model="form.fixedAllowance.phoneAllowance"
                :min="0"
                :max="9999999999999.99"
                :precision="2"
            /></el-form-item>
            <el-form-item label="电脑（元）"
              ><el-input-number
                v-model="form.fixedAllowance.computerAllowance"
                :min="0"
                :max="9999999999999.99"
                :precision="2"
            /></el-form-item>
            <el-form-item label="每月合计（元）"
              ><strong>{{ costMoney(fixedAllowanceTotal) }}</strong></el-form-item
            >
          </template>
        </template>
        <el-form-item
          v-if="
            kind !== 'CITY_MANAGER' &&
            kind !== 'COMMISSION' &&
            !(kind === 'ALLOWANCE' && form.allowanceTypeCode === 'FIXED_ALLOWANCE')
          "
          :label="kind === 'PERFORMANCE' ? '满额月绩效（元）' : '每月金额（元）'"
          :required="form.performancePolicy?.mode !== 'SALES_KPI'"
          ><el-input-number v-model="form.amount" :min="0" :precision="2" :max="99999999999999.99"
        /></el-form-item>
        <template v-if="kind === 'PERFORMANCE' && form.performancePolicy">
          <el-form-item label="绩效模式" required
            ><CostDictSelect v-model="form.performancePolicy.mode" code="PAYROLL_PERFORMANCE_MODE"
          /></el-form-item>
          <template v-if="form.performancePolicy.mode === 'SALES_KPI'">
            <el-alert
              title="绩效金额可暂不配置；核算时缺少当月所需金额会进入待核对，也可在月度工资中调整并留痕。"
              type="info"
              :closable="false"
            />
            <el-form-item label="铜牌绩效（元）"
              ><el-input-number v-model="form.performancePolicy.bronzeBase" :min="0" :precision="2"
            /></el-form-item>
            <el-form-item label="首月口径" required
              ><CostDictSelect
                v-model="form.performancePolicy.firstMonthMode"
                code="PAYROLL_FIRST_MONTH_MODE"
            /></el-form-item>
            <el-divider content-position="left">过程考核 · 自然日，最低为 0</el-divider>
            <el-form-item label="过程占比（%）"
              ><el-input-number
                v-model="form.performancePolicy.processPercent"
                :min="0"
                :max="100"
                :precision="0"
              /><span class="field-hint">
                回款占比 {{ 100 - form.performancePolicy.processPercent }}%</span
              ></el-form-item
            >
            <el-form-item label="每日打卡目标"
              ><el-input-number
                v-model="form.performancePolicy.dailyCheckins"
                :min="0"
                :max="100"
                :precision="0"
            /></el-form-item>
            <el-form-item label="每缺打卡扣款"
              ><el-input-number
                v-model="form.performancePolicy.checkinPenalty"
                :min="0"
                :precision="2"
            /></el-form-item>
            <el-form-item label="每日有效拜访"
              ><el-input-number
                v-model="form.performancePolicy.dailyVisits"
                :min="0"
                :max="100"
                :precision="0"
            /></el-form-item>
            <el-form-item label="有效沟通（分钟）"
              ><el-input-number v-model="minimumMinutes" :min="1 / 60" :max="1440"
            /></el-form-item>
            <el-form-item label="每缺拜访扣款"
              ><el-input-number
                v-model="form.performancePolicy.visitPenalty"
                :min="0"
                :precision="2"
            /></el-form-item>
            <el-divider content-position="left">回款考核 · 未完成按实际回款比例发放</el-divider>
            <el-form-item label="次月目标（元）"
              ><el-input-number
                v-model="form.performancePolicy.secondMonthTarget"
                :min="0.01"
                :precision="2"
            /></el-form-item>
            <el-form-item label="第三月起（元）"
              ><el-input-number
                v-model="form.performancePolicy.laterMonthTarget"
                :min="0.01"
                :precision="2"
            /></el-form-item>
          </template>
        </template>
        <el-form-item label="生效日期" required
          ><el-date-picker
            v-model="form.effectiveFrom"
            value-format="YYYY-MM-DD"
            placeholder="选择生效日期" /></el-form-item
        ><el-form-item label="有效期"
          ><el-checkbox v-model="longTerm">长期有效</el-checkbox></el-form-item
        ><el-form-item v-if="!longTerm" label="截止日期" required
          ><el-date-picker
            v-model="form.effectiveTo"
            value-format="YYYY-MM-DD"
            placeholder="选择截止日期"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-switch
            v-model="form.enabled"
            active-text="启用"
            inactive-text="停用" /></el-form-item
        ><el-form-item label="备注 / 变更说明"
          ><el-input v-model="form.remark" type="textarea" maxlength="500" show-word-limit
        /></el-form-item> </el-form
      ><template #footer
        ><el-button @click="visible = false">关闭</el-button
        ><el-button
          v-if="can('hr:payroll-rule:write')"
          type="primary"
          :loading="saving"
          @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { errorMessage } from '@/api/core/error'
import { departmentTree } from '@/utils/hr-department-tree'
import { getCostCities } from '@/api/core/cost'
import {
  getCommissionPolicies,
  getPayrollDepartments,
  getPayrollEmployees,
  getPayrollProducts,
  getPayrollRules,
  savePayrollRule,
  type CommissionPolicy,
  type PayrollDepartment,
  type PayrollEmployee,
  type PayrollPage,
  type PayrollProduct,
  type PayrollRule,
  type PayrollRuleCommand,
  type PayrollRuleKind,
} from '@/api/core/payroll'
import CostDictSelect from '../cost/CostDictSelect.vue'
import { costLabel, costMoney, loadCostDictionaries } from '../cost/cost-dictionaries'
const route = useRoute(),
  { can } = useSupplyPermissions()
const commissionPage = computed(() => route.path.endsWith('/commission-rules'))
type PayrollRulePageKind = Exclude<PayrollRuleKind, 'BASE'>
const commissionTab = ref<'COMMISSION' | 'CITY_MANAGER'>('COMMISSION')
const kind = computed<PayrollRulePageKind>(() =>
  commissionPage.value
    ? commissionTab.value
    : route.path.endsWith('/performance-rules')
      ? 'PERFORMANCE'
      : 'ALLOWANCE',
)
const titles: Record<PayrollRulePageKind, string> = {
  COMMISSION: '商品提成规则',
  PERFORMANCE: '绩效规则',
  ALLOWANCE: '其他薪资',
  CITY_MANAGER: '城市总提成归属',
}
const title = computed(() => titles[kind.value])
const description = computed(() =>
  kind.value === 'CITY_MANAGER'
    ? '设置城市总提成的归属人员、城市和生效期间；提成标准在商品提成规则中维护。'
    : kind.value === 'COMMISSION'
      ? '按商品规格、受益角色、销售部门和有效期间配置；整单回款后发放。'
      : kind.value === 'PERFORMANCE'
        ? '仅适用于销售人员，按过程与回款核算绩效；首月按铜牌金额，固定补贴在其他薪资设置维护。'
        : '仅适用于销售人员。类型选择固定补贴后分别配置交通、话费、电脑补贴，自动合计。',
)
const keyword = ref(''),
  currentPage = ref(1),
  pageSize = ref(20),
  loading = ref(false),
  loadError = ref('')
const page = ref<PayrollPage<PayrollRule>>({ total: 0, begin: 0, step: 20, items: [] })
const employees = ref<PayrollEmployee[]>([]),
  departments = ref<PayrollDepartment[]>([]),
  policies = ref<CommissionPolicy[]>([])
const departmentOptionsTree = computed(() => departmentTree(departments.value))
const cities = ref<{ code: string; name: string }[]>([])
const visible = ref(false),
  saving = ref(false),
  editorError = ref(''),
  editingId = ref<string | null>(null),
  products = ref<PayrollProduct[]>([]),
  productsLoading = ref(false)
function blank(): PayrollRuleCommand {
  return {
    requestId: crypto.randomUUID(),
    revision: null,
    name: '',
    kindCode: kind.value,
    employeeCode: null,
    departmentIds: [],
    cityCode: null,
    cityName: null,
    includeOwnSalesCommission: true,
    productId: null,
    productVariantId: null,
    productName: null,
    unitCode: null,
    groupCode: null,
    recipientRoleCode: 'SALES',
    methodCode: null,
    rate: null,
    amount: null,
    effectiveFrom: '',
    effectiveTo: '',
    enabled: true,
    remark: '',
    allowanceTypeCode: kind.value === 'ALLOWANCE' ? 'FIXED_ALLOWANCE' : null,
    fixedAllowance:
      kind.value === 'ALLOWANCE'
        ? { vehicleAllowance: 500, phoneAllowance: 150, computerAllowance: 100 }
        : null,
    performancePolicy:
      kind.value === 'PERFORMANCE'
        ? {
            mode: 'SALES_KPI',
            bronzeBase: null,
            firstMonthMode: 'EXEMPT_ALL',
            processPercent: 40,
            dailyCheckins: 7,
            checkinPenalty: 20,
            dailyVisits: 3,
            minimumSeconds: 600,
            visitPenalty: 30,
            secondMonthTarget: 5000,
            laterMonthTarget: 7000,
          }
        : null,
  }
}
const form = ref<PayrollRuleCommand>(blank())
const includeChildren = ref(false),
  longTerm = ref(true)
const coveredDepartments = computed(() => {
  const ids = new Set(form.value.departmentIds)
  if (includeChildren.value) {
    let changed = true
    while (changed) {
      changed = false
      for (const d of departments.value)
        if (d.parentId != null && ids.has(d.parentId) && !ids.has(d.id)) {
          ids.add(d.id)
          changed = true
        }
    }
  }
  return [...ids]
})
const coveredEmployees = computed(
  () =>
    employees.value.filter(
      (e) =>
        e.payrollCategory === 'SALES' &&
        e.departmentId != null &&
        coveredDepartments.value.includes(e.departmentId),
    ).length,
)
const minimumMinutes = computed({
  get: () => (form.value.performancePolicy?.minimumSeconds ?? 600) / 60,
  set: (value: number | undefined) => {
    if (form.value.performancePolicy)
      form.value.performancePolicy.minimumSeconds = Math.max(1, Math.round((value ?? 10) * 60))
  },
})
function copyRule(row: PayrollRule) {
  edit(row)
  editingId.value = null
  form.value.requestId = crypto.randomUUID()
  form.value.revision = null
  form.value.name += '（副本）'
  form.value.enabled = false
  editorError.value = '已复制为停用草稿，请修改部门、商品、受益角色或期间后启用，避免规则重复。'
}
const fixedAllowanceTotal = computed(() => {
  const fixed = form.value.fixedAllowance
  return fixed
    ? Math.round(
        ((fixed.vehicleAllowance || 0) +
          (fixed.phoneAllowance || 0) +
          (fixed.computerAllowance || 0)) *
          100,
      ) / 100
    : 0
})
function allowanceTypeChanged() {
  if (form.value.allowanceTypeCode === 'FIXED_ALLOWANCE') {
    form.value.fixedAllowance ??= {
      vehicleAllowance: 500,
      phoneAllowance: 150,
      computerAllowance: 100,
    }
    if (!form.value.name) form.value.name = '销售固定补贴'
  } else {
    form.value.fixedAllowance = null
  }
}
let version = 0,
  productVersion = 0
async function load() {
  const id = ++version
  loading.value = true
  loadError.value = ''
  try {
    const result = await getPayrollRules({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      kindCode: kind.value,
      keyword: keyword.value,
    })
    if (id === version) page.value = result
  } catch (e) {
    if (id === version) {
      page.value.items = []
      page.value.total = 0
      loadError.value = errorMessage(e, '规则查询失败')
    }
  } finally {
    if (id === version) loading.value = false
  }
}
function reset() {
  keyword.value = ''
  search()
}
function search() {
  currentPage.value = 1
  void load()
}
async function references() {
  const result = await Promise.allSettled([
    loadCostDictionaries(),
    getPayrollEmployees(true),
    getPayrollDepartments(),
    getCommissionPolicies(),
    getCostCities(),
  ])
  const [, people, deps, templates, regions] = result
  if (regions.status === 'fulfilled') cities.value = regions.value
  if (people.status === 'fulfilled') employees.value = people.value
  if (deps.status === 'fulfilled') departments.value = deps.value
  if (templates.status === 'fulfilled') policies.value = templates.value
  result.forEach((r) => {
    if (r.status === 'rejected') ElMessage.error(errorMessage(r.reason, '规则选项加载失败'))
  })
}
function employeeName(code: string | null) {
  return employees.value.find((e) => e.employeeCode === code)?.employeeName ?? code ?? '—'
}
function departmentNames(ids: number[]) {
  return ids.map((id) => departments.value.find((d) => d.id === id)?.name ?? String(id)).join('、')
}
function productLabel(p: PayrollProduct) {
  return (
    p.productName +
    ' · ' +
    (p.specification || p.variantCode) +
    ' · ' +
    p.variantCode +
    ' · ' +
    costLabel('PRODUCT_UNIT', p.unitCode)
  )
}
function edit(row?: PayrollRule) {
  includeChildren.value = false
  longTerm.value = !row || row.data.effectiveTo === '9999-12-31'
  editingId.value = row?.id ?? null
  form.value = row ? { ...JSON.parse(JSON.stringify(row.data)), revision: row.revision } : blank()
  editorError.value = ''
  products.value = row?.data.productVariantId
    ? [
        {
          productId: row.data.productId!,
          productVariantId: row.data.productVariantId,
          productName: row.data.productName ?? '',
          productCode: '',
          variantCode: String(row.data.productVariantId),
          specification: '',
          unitCode: row.data.unitCode ?? '',
        },
      ]
    : []
  visible.value = true
  void references()
}
function applyPolicy() {
  const policy = policies.value.find((p) => p.code === form.value.groupCode)
  if (!policy) return
  form.value.methodCode = policy.methodCode
  form.value.rate =
    form.value.recipientRoleCode === 'CITY_MANAGER' ? policy.managerRate : policy.salesRate
  if (!form.value.name) form.value.name = policy.name + '提成'
}
async function searchProducts(query: string) {
  const id = ++productVersion
  productsLoading.value = true
  try {
    const result = await getPayrollProducts(query)
    if (id === productVersion) {
      const selected = products.value.filter(
        (p) => p.productVariantId === form.value.productVariantId,
      )
      products.value = Array.from(
        new Map([...selected, ...result].map((p) => [p.productVariantId, p])).values(),
      )
    }
  } catch (e) {
    editorError.value = errorMessage(e, '商品查询失败')
  } finally {
    if (id === productVersion) productsLoading.value = false
  }
}
function selectProduct() {
  const p = products.value.find((p) => p.productVariantId === form.value.productVariantId)
  form.value.productId = p?.productId ?? null
  form.value.productName = p
    ? p.productName + (p.specification ? ' · ' + p.specification : '')
    : null
  form.value.unitCode = p?.unitCode ?? null
}
async function save() {
  if (
    !form.value.name.trim() ||
    !form.value.effectiveFrom ||
    (!longTerm.value && !form.value.effectiveTo) ||
    (kind.value !== 'CITY_MANAGER' && !form.value.departmentIds.length) ||
    (kind.value === 'CITY_MANAGER' && (!form.value.employeeCode || !form.value.cityCode))
  ) {
    editorError.value = '请填写规则名称、适用对象和生效期间'
    return
  }
  saving.value = true
  editorError.value = ''
  try {
    const command = {
      ...form.value,
      departmentIds: coveredDepartments.value,
      effectiveTo: longTerm.value ? '9999-12-31' : form.value.effectiveTo,
    }
    if (kind.value === 'ALLOWANCE' && command.allowanceTypeCode === 'FIXED_ALLOWANCE')
      command.amount = fixedAllowanceTotal.value
    await savePayrollRule(editingId.value, command)
    visible.value = false
    ElMessage.success('规则已保存')
    await load()
  } catch (e) {
    editorError.value = errorMessage(e, '保存失败')
  } finally {
    saving.value = false
  }
}
watch(
  kind,
  () => {
    visible.value = false
    keyword.value = ''
    search()
  },
  { immediate: true },
)
void references()
</script>
<style scoped lang="scss">
.payroll-rule-page {
  gap: 16px;
}
.page-heading,
.result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.page-heading p,
.field-hint {
  color: var(--el-text-color-regular);
  font-size: 13px;
}
.full-width,
.el-form :deep(.el-select) {
  width: 100%;
}
.el-alert {
  margin-bottom: 14px;
}
.el-pagination {
  justify-content: flex-end;
  margin-top: 16px;
}
@media (max-width: 768px) {
  .page-heading {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

<style>
.payroll-rule-dialog .el-alert--info .el-alert__title {
  color: var(--el-text-color-regular);
}
.payroll-rule-dialog .el-dialog__body {
  max-height: 65vh;
  overflow: auto;
  padding-right: 16px;
}
.payroll-rule-dialog .el-dialog__footer {
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
