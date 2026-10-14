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
    <el-tabs v-if="commissionPage" v-model="commissionTab"
      ><el-tab-pane name="COMMISSION" label="商品提成" /><el-tab-pane
        name="CITY_MANAGER"
        label="城市总提成"
    /></el-tabs>
    <CityManagerPanel
      v-if="kind === 'CITY_MANAGER'"
      ref="managerPanel"
      :employees="employees"
      :cities="cities"
      :can-write="can('hr:payroll-rule:write')"
      @edit="edit"
      @add-city="addManagedCity"
    />
    <template v-else>
      <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
      <SupplyListFilters :loading="loading" @search="search" @reset="reset">
        <el-form-item label="规则名称"
          ><el-input
            v-model="keyword"
            aria-label="规则名称筛选"
            placeholder="请输入规则名称"
            clearable
        /></el-form-item>
      </SupplyListFilters>
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
          <el-table-column label="适用部门" min-width="190" show-overflow-tooltip
            ><template #default="{ row }">{{
              departmentNames(row.data.departmentIds)
            }}</template></el-table-column
          >
          <template v-if="kind === 'COMMISSION'"
            ><el-table-column label="商品分类" min-width="140"
              ><template #default="{ row }">{{
                row.data.categoryName || '待补充分类'
              }}</template></el-table-column
            ><el-table-column
              prop="data.productName"
              label="商品规格型号"
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
            v-if="kind !== 'COMMISSION'"
            :label="kind === 'PERFORMANCE' ? '满额月绩效（元）' : '每月金额（元）'"
            align="right"
            width="160"
            ><template #default="{ row }">{{
              costMoney(row.data.amount)
            }}</template></el-table-column
          >
          <el-table-column prop="data.effectiveFrom" label="生效日期" width="115" />
          <el-table-column label="截止日期" width="115">
            <template #default="{ row }">{{
              row.data.effectiveTo === '9999-12-31' ? '长期有效' : row.data.effectiveTo
            }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }"
              ><el-tag :type="row.data.enabled ? 'success' : 'info'">{{
                row.data.enabled ? '启用' : '停用'
              }}</el-tag></template
            >
          </el-table-column>
          <el-table-column
            prop="data.remark"
            label="备注"
            min-width="140"
            show-overflow-tooltip
          /><el-table-column label="操作" fixed="right" :width="kind === 'COMMISSION' ? 90 : 150"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="edit(row as PayrollRule)">{{
                can('hr:payroll-rule:write') ? '编辑' : '查看'
              }}</el-button
              ><el-button
                v-if="!commissionPage && can('hr:payroll-rule:write')"
                link
                type="primary"
                @click="copyRule(row as PayrollRule)"
                >复制</el-button
              >
            </template></el-table-column
          > </el-table
        ><el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="page.total"
          layout="total, sizes, prev, pager, next"
          @current-change="load"
          @size-change="search"
      /></el-card>
    </template>
    <CityCommissionEditor
      ref="cityEditor"
      :employees="employees"
      :cities="cities"
      :can-write="can('hr:payroll-rule:write')"
      @saved="load"
    />
    <el-dialog
      v-model="visible"
      :title="(editingId ? '编辑' : '新增') + title"
      width="min(800px, 96vw)"
      class="payroll-rule-dialog"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-alert v-if="editorError" :title="editorError" type="error" :closable="false" />
      <el-form
        :label-position="commissionPage ? 'top' : 'right'"
        :label-width="commissionPage ? undefined : '120px'"
        :class="{ 'compact-commission-form': commissionPage }"
        :disabled="!can('hr:payroll-rule:write') || saving"
      >
        <el-form-item label="规则名称" required
          ><el-input v-model="form.name" maxlength="120"
        /></el-form-item>
        <el-form-item class="full-row" label="适用部门" required
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
        <template v-if="kind === 'COMMISSION'">
          <el-form-item label="商品分类" required>
            <el-tree-select
              v-model="form.categoryId"
              :data="categoryTree"
              node-key="id"
              :props="{ label: 'name', children: 'children' }"
              check-strictly
              filterable
              clearable
              :render-after-expand="false"
              aria-label="商品分类"
              placeholder="选择商品分类"
              @change="categoryChanged"
            />
          </el-form-item>
          <el-form-item label="规格型号" required>
            <div class="full-width">
              <el-select
                v-model="form.productVariantId"
                filterable
                remote
                :remote-method="searchProducts"
                :loading="productsLoading"
                :disabled="!form.categoryId"
                aria-label="规格型号"
                placeholder="先选分类，再搜索商品、型号或编码"
                @visible-change="productOpened"
                @change="selectProduct"
              >
                <template #label="{ label }">{{ selectedProductLabel || label }}</template>
                <el-option
                  v-for="p in products"
                  :key="p.productVariantId"
                  :value="p.productVariantId"
                  :label="productLabel(p)"
                />
              </el-select>
            </div>
          </el-form-item>
          <el-form-item label="受益角色" required
            ><CostDictSelect v-model="form.recipientRoleCode" code="COMMISSION_RECIPIENT_ROLE"
          /></el-form-item>
          <el-form-item label="计算方式" required>
            <CostDictSelect v-model="form.methodCode" code="PAYROLL_COMMISSION_METHOD" />
          </el-form-item>
          <el-form-item label="提成标准" required>
            <div class="full-width">
              <div class="commission-rate">
                <el-input-number
                  v-model="form.rate"
                  aria-label="提成标准"
                  :min="0"
                  :max="form.methodCode === 'PERCENT' ? 100 : 99999999999999.99"
                  :precision="2"
                  :disabled="
                    !form.methodCode ||
                    productsLoading ||
                    (form.methodCode === 'QUANTITY' && !hasCommissionUnit)
                  "
                  :controls="false"
                  placeholder="请输入提成标准"
                />
                <span v-if="form.methodCode === 'PERCENT'" class="commission-rate__unit">%</span>
                <span
                  v-else-if="form.methodCode === 'QUANTITY' && hasCommissionUnit"
                  class="commission-rate__unit"
                >
                  元 / {{ costLabel('PRODUCT_UNIT', form.unitCode) }}
                </span>
              </div>
              <p v-if="!form.methodCode" class="field-hint commission-rate__hint">
                请先选择计算方式
              </p>
              <p
                v-else-if="form.methodCode === 'QUANTITY' && !hasCommissionUnit"
                class="field-hint commission-rate__hint"
              >
                {{
                  form.productVariantId
                    ? '该规格缺少计量单位，请完善商品资料'
                    : '请先选择规格型号，自动带出计量单位'
                }}
              </p>
            </div>
          </el-form-item>
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
            placeholder="选择生效日期"
        /></el-form-item>
        <el-form-item label="有效期"
          ><el-checkbox v-model="longTerm">长期有效</el-checkbox></el-form-item
        >
        <el-form-item v-if="!longTerm" label="截止日期" required
          ><el-date-picker
            v-model="form.effectiveTo"
            value-format="YYYY-MM-DD"
            placeholder="选择截止日期"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-switch v-model="form.enabled" active-text="启用" inactive-text="停用"
        /></el-form-item>
        <el-form-item class="full-row" label="备注 / 变更说明"
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
import SupplyListFilters from '@/components/supply/SupplyListFilters.vue'
import CityManagerPanel from './components/CityManagerPanel.vue'
import CityCommissionEditor from './components/CityCommissionEditor.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { errorMessage } from '@/api/core/error'
import { departmentTree } from '@/utils/hr-department-tree'
import { getCostCities } from '@/api/core/cost'
import {
  getPayrollDepartments,
  getPayrollEmployees,
  getPayrollProducts,
  getPayrollProductCategories,
  type PayrollCategory,
  getPayrollRules,
  savePayrollRule,
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
const cityEditor = ref<InstanceType<typeof CityCommissionEditor>>()
const managerPanel = ref<InstanceType<typeof CityManagerPanel>>()
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
  CITY_MANAGER: '城市总提成',
}
const title = computed(() => titles[kind.value])
const description = computed(() =>
  kind.value === 'CITY_MANAGER'
    ? '按城市配置团队比例、本人提成和独立商品标准。'
    : kind.value === 'COMMISSION'
      ? '先选商品分类，再按具体型号、受益角色和生效期间设置；整单回款后计提。'
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
  departments = ref<PayrollDepartment[]>([])
const departmentOptionsTree = computed(() => departmentTree(departments.value))
const categories = ref<PayrollCategory[]>([])
const categoryTree = computed(() => departmentTree(categories.value))
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
    includeOwnSalesCommission: null,
    productId: null,
    productVariantId: null,
    productName: null,
    unitCode: null,
    categoryId: null,
    categoryName: null,
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
// Remote select caches its selected label; render the refreshed ERP label directly.
const selectedProductLabel = computed(() => {
  const product = products.value.find((p) => p.productVariantId === form.value.productVariantId)
  return product ? productLabel(product) : ''
})
const hasCommissionUnit = computed(() =>
  Boolean(form.value.productVariantId && form.value.unitCode?.trim()),
)
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
  if (kind.value === 'CITY_MANAGER') {
    loading.value = false
    return managerPanel.value?.reload()
  }
  loading.value = true
  loadError.value = ''
  try {
    await loadCostDictionaries()
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
    getCostCities(),
    kind.value === 'COMMISSION'
      ? getPayrollProductCategories()
      : Promise.resolve([] as PayrollCategory[]),
  ])
  const [, people, deps, regions, categoryResult] = result
  if (categoryResult?.status === 'fulfilled')
    categories.value = categoryResult.value as PayrollCategory[]
  if (regions.status === 'fulfilled') cities.value = regions.value
  if (people.status === 'fulfilled') employees.value = people.value
  if (deps.status === 'fulfilled') departments.value = deps.value
  result.forEach((r) => {
    if (r.status === 'rejected') ElMessage.error(errorMessage(r.reason, '规则选项加载失败'))
  })
}
function departmentNames(ids: number[]) {
  return ids.map((id) => departments.value.find((d) => d.id === id)?.name ?? String(id)).join('、')
}
function productLabel(p: PayrollProduct) {
  return [
    p.productName,
    p.specification,
    p.variantCode,
    p.unitCode ? costLabel('PRODUCT_UNIT', p.unitCode) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
function edit(row?: PayrollRule) {
  if (kind.value === 'CITY_MANAGER') {
    cityEditor.value?.open(blank(), row)
    void references()
    return
  }
  ++productVersion
  productsLoading.value = false
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
          variantCode: '',
          specification: '',
          unitCode: row.data.unitCode ?? '',
          categoryId: row.data.categoryId ?? null,
          categoryName: row.data.categoryName ?? null,
        },
      ]
    : []
  visible.value = true
  if (kind.value === 'COMMISSION' && row?.data.productVariantId)
    void hydrateProduct(row.data.productVariantId)
  void references()
}
function addManagedCity(row: PayrollRule) {
  cityEditor.value?.open(blank(), undefined, row.data.employeeCode ?? undefined)
  void references()
}
async function hydrateProduct(variant: string) {
  const id = ++productVersion
  productsLoading.value = true
  try {
    const rows = await getPayrollProducts('', null, variant)
    if (id !== productVersion || !visible.value) return
    const p = rows.find((p) => p.productVariantId === variant)
    if (!p) {
      editorError.value = '原商品规格已不可用，请重新选择'
      return
    }
    products.value = [p]
    form.value.categoryId = p.categoryId
    form.value.categoryName = p.categoryName
    selectProduct()
  } catch (e) {
    if (id === productVersion) editorError.value = errorMessage(e, '商品资料加载失败')
  } finally {
    if (id === productVersion) productsLoading.value = false
  }
}
function categoryChanged() {
  ++productVersion
  products.value = []
  form.value.productId = null
  form.value.productVariantId = null
  form.value.productName = null
  form.value.unitCode = null
  form.value.categoryName = null
  if (form.value.categoryId) void searchProducts('')
}
function productOpened(open: boolean) {
  if (open && !products.value.length) void searchProducts('')
}
async function searchProducts(query: string) {
  if (!form.value.categoryId) return
  const id = ++productVersion
  productsLoading.value = true
  try {
    const result = await getPayrollProducts(query, form.value.categoryId)
    if (id === productVersion) {
      const selected = products.value.filter(
        (p) => p.productVariantId === form.value.productVariantId,
      )
      products.value = Array.from(
        new Map([...selected, ...result].map((p) => [p.productVariantId, p])).values(),
      )
    }
  } catch (e) {
    if (id === productVersion) editorError.value = errorMessage(e, '商品查询失败')
  } finally {
    if (id === productVersion) productsLoading.value = false
  }
}
function selectProduct() {
  const p = products.value.find((p) => p.productVariantId === form.value.productVariantId)
  form.value.categoryId = p?.categoryId ?? form.value.categoryId
  form.value.categoryName = p?.categoryName ?? null
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
    !form.value.departmentIds.length
  ) {
    editorError.value = '请填写规则名称、适用对象和生效期间'
    return
  }
  if (!longTerm.value && form.value.effectiveTo < form.value.effectiveFrom) {
    editorError.value = '结束日期不能早于开始日期'
    return
  }
  if (
    kind.value === 'COMMISSION' &&
    (!form.value.categoryId ||
      !form.value.productVariantId ||
      !form.value.methodCode ||
      form.value.rate == null)
  ) {
    editorError.value = '请选择商品分类、规格型号并填写提成标准'
    return
  }
  if (kind.value === 'COMMISSION' && productsLoading.value) {
    editorError.value = '商品资料加载中，请稍后再保存'
    return
  }
  if (
    kind.value === 'COMMISSION' &&
    form.value.methodCode === 'QUANTITY' &&
    !hasCommissionUnit.value
  ) {
    editorError.value = '该规格缺少计量单位，请完善商品资料'
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
.compact-commission-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 20px;
}
.compact-commission-form .full-row {
  grid-column: 1 / -1;
}
.compact-commission-form :deep(.el-date-editor) {
  width: 100%;
}
@media (max-width: 600px) {
  .compact-commission-form {
    grid-template-columns: 1fr;
  }
}
.commission-rate {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.commission-rate :deep(.el-input-number) {
  width: 220px;
  max-width: 100%;
}
.commission-rate__unit {
  white-space: nowrap;
  color: var(--el-text-color-regular);
}
.commission-rate__hint {
  margin: 6px 0 0;
  line-height: 1.5;
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
