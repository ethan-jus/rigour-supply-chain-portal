<template>
  <div class="supply-page employee-page">
    <el-alert v-if="directoryError" :title="directoryError" type="error" :closable="false" />
    <div class="directory-layout">
      <DepartmentSidebar
        :departments="departmentChoices"
        :show-all="false"
        :model-value="departmentId"
        @update:model-value="selectDepartment"
        ><template #heading-actions
          ><el-checkbox v-model="includeSubDepartments" @change="search"
            >含子部门</el-checkbox
          ></template
        ></DepartmentSidebar
      >
      <section class="employee-results" aria-label="员工列表">
        <header class="employee-directory-header">
          <div class="department-context">
            <span class="department-context-icon" aria-hidden="true"
              ><el-icon><OfficeBuilding /></el-icon
            ></span>
            <div class="department-context-copy">
              <div class="department-title">
                <h1>{{ selectedDepartment?.departmentName || '员工档案' }}</h1>
                <span class="employee-count">{{ loading ? '加载中…' : `${data.total} 人` }}</span>
              </div>
              <p>
                {{ includeSubDepartments ? '含下级部门' : '仅当前部门'
                }}<span>·</span>负责人姓名加粗高亮
              </p>
            </div>
          </div>
          <div class="directory-actions">
            <DhbSalespersonSyncButton @completed="refresh" />
            <el-button :loading="loading" :icon="Refresh" @click="refresh">刷新</el-button>
            <el-button
              v-if="can('hr:employee:create')"
              type="primary"
              :icon="Plus"
              @click="openEditor()"
              >新增员工</el-button
            >
          </div>
        </header>
        <OrderRegisterFilterCard :loading="loading" query-first @search="search" @reset="reset">
          <template #primary>
            <el-input
              v-model="keyword"
              clearable
              aria-label="关键词"
              placeholder="姓名 / 手机号 / 编号 / 订货宝账号"
              class="employee-keyword"
              :prefix-icon="Search"
            />
            <el-select
              v-model="positionCode"
              filterable
              clearable
              aria-label="岗位"
              placeholder="全部岗位"
              style="width: 125px"
            >
              <el-option
                v-for="p in positions"
                :key="p.positionCode"
                :label="p.positionName"
                :value="p.positionCode"
              />
            </el-select>
            <el-select
              v-model="status"
              clearable
              aria-label="在职状态"
              placeholder="在职状态"
              style="width: 125px"
            >
              <el-option label="在职" value="ACTIVE" /><el-option label="离职" value="LEFT" />
              <el-option label="停用" value="INACTIVE" /><el-option
                label="待确认"
                value="PENDING"
              />
            </el-select>
            <el-select
              v-model="regularized"
              clearable
              aria-label="是否转正"
              placeholder="是否转正"
              style="width: 125px"
            >
              <el-option :value="true" label="已转正" /><el-option :value="false" label="未转正" />
            </el-select>
            <el-select
              v-model="payrollCategory"
              clearable
              aria-label="薪酬类别"
              placeholder="薪酬类别"
              style="width: 125px"
            >
              <el-option
                v-for="option in payrollCategories"
                :key="option.value"
                :value="option.value"
                :label="option.label"
              />
            </el-select>
            <el-select
              v-model="payrollMissing"
              aria-label="薪酬档案完整度"
              style="width: 135px"
              @change="search"
              ><el-option :value="false" label="全部薪酬档案" /><el-option
                :value="true"
                label="薪酬待完善"
            /></el-select>
            <el-input
              v-model="jobGrade"
              clearable
              aria-label="职级"
              placeholder="职级"
              style="width: 110px"
            />
          </template>
        </OrderRegisterFilterCard>
        <el-alert v-if="riskError" :title="riskError" type="error" :closable="false" />
        <div v-if="risks.length" class="binding-risk-banner" role="status">
          <el-icon><WarningFilled /></el-icon><strong>{{ risks.length }} 条关联待确认</strong>
          <span>来源姓名或手机号与员工档案不一致，请核对关联</span>
          <el-button link type="primary" @click="openReviews()">查看并处理</el-button>
        </div>
        <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
        <div class="employee-list-caption">
          <span>员工列表</span><span class="sort-hint">{{ sortDescription }}</span>
        </div>
        <div class="employee-table-viewport">
          <el-table
            v-loading="loading"
            :data="data.items"
            row-key="id"
            ref="employeeTable"
            height="100%"
            table-layout="fixed"
            :default-sort="{ prop: 'entryDate', order: 'descending' }"
            :row-class-name="employeeRowClass"
            @sort-change="sortChanged"
            @row-click="(row: HrEmployeeRecord) => openDetail(row)"
          >
            <el-table-column
              prop="employeeName"
              sortable="custom"
              label="姓名"
              min-width="170"
              fixed="left"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span
                  :class="[
                    'employee-name',
                    { 'employee-name--leader': leaderDepartments.has(row.employeeCode) },
                  ]"
                  :title="
                    leaderDepartments.has(row.employeeCode)
                      ? `${leaderDepartments.get(row.employeeCode)?.join('、')}负责人`
                      : undefined
                  "
                  >{{ row.employeeName }}</span
                >
              </template>
            </el-table-column>
            <el-table-column prop="employmentStatus" label="在职状态" width="92">
              <template #default="{ row }">
                <span :class="['employment-status', statusClass(row.employmentStatus)]"
                  ><i aria-hidden="true" />{{ statusLabel(row.employmentStatus) }}</span
                >
              </template>
            </el-table-column>
            <el-table-column
              prop="departmentName"
              label="部门"
              min-width="110"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{ row.departmentName || '未分配部门' }}</template>
            </el-table-column>
            <el-table-column
              prop="positionName"
              label="岗位"
              min-width="100"
              show-overflow-tooltip
            />
            <el-table-column prop="entryDate" label="入职时间" sortable="custom" width="120">
              <template #default="{ row }">{{ dateOnly(row.entryDate) || '—' }}</template>
            </el-table-column>
            <el-table-column prop="mobile" label="手机号" width="125" show-overflow-tooltip />
            <!-- @vue-generic {HrEmployeeRecord} -->
            <el-table-column label="订货宝账号" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="dhb-account-cell"
                  ><span class="dhb-account" :title="row.dhbAccountNames?.join('、')">{{
                    row.dhbAccountNames?.join('、') || '—'
                  }}</span>
                  <el-button
                    v-if="row.dhbAccountNames?.length"
                    link
                    aria-label="复制订货宝账号"
                    @click.stop="copyAccount(row)"
                    ><el-icon><CopyDocument /></el-icon
                  ></el-button>
                </span>
              </template>
            </el-table-column>
            <el-table-column
              prop="employeeCode"
              sortable="custom"
              label="员工编号"
              width="165"
              show-overflow-tooltip
            />
            <el-table-column label="是否转正" width="100">
              <template #default="{ row }"
                ><el-tag
                  :type="row.regularized == null ? 'info' : row.regularized ? 'success' : 'warning'"
                  >{{ regularizationLabel(row.regularized) }}</el-tag
                ></template
              >
            </el-table-column>
            <el-table-column label="薪酬类别" width="100">
              <template #default="{ row }">{{
                payrollCategoryLabel(row.payrollCategory)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="createdTime"
              label="创建时间"
              sortable="custom"
              width="183"
              show-overflow-tooltip
              ><template #default="{ row }">{{
                auditTime(row.createdTime)
              }}</template></el-table-column
            >
            <el-table-column label="关联状态" width="128"
              ><template #default="{ row }">
                <el-tag v-if="row.dhbReviewCount" type="warning">已关联·待确认</el-tag>
                <el-tag v-else-if="row.dhbStaffIds?.length" type="success">已关联</el-tag
                ><span v-else class="muted">未关联</span>
              </template></el-table-column
            >
            <!-- @vue-generic {HrEmployeeRecord} -->
            <el-table-column label="操作" width="135" fixed="right"
              ><template #default="{ row }"
                ><el-button
                  v-if="row.dhbReviewCount"
                  link
                  type="primary"
                  @click.stop="openReviews(row.id)"
                  >查看关联</el-button
                ><el-button v-else link type="primary" @click.stop="openDetail(row)">详情</el-button
                ><el-button
                  v-if="can('hr:employee:update')"
                  link
                  type="primary"
                  @click.stop="openEditor(row)"
                  >编辑</el-button
                ></template
              ></el-table-column
            >
          </el-table>
        </div>
        <footer class="employee-list-footer">
          <span>在职在前 · 离职在后</span
          ><el-pagination
            v-model:current-page="page"
            v-model:page-size="size"
            :total="data.total"
            :page-sizes="[20, 50, 100]"
            layout="total,sizes,prev,pager,next"
            @current-change="load"
            @size-change="search"
          />
        </footer>
      </section>
    </div>
    <DhbBindingReviewDrawer
      v-model="reviewVisible"
      :risks="risks"
      :employee-id="reviewEmployeeId"
      @resolved="refresh"
    />
    <HrEmployeeEditor
      v-model="editorVisible"
      :record="editing"
      :department-id="departmentId"
      :initial-tab="editorInitialTab"
      @saved="load"
    />
    <el-dialog
      v-model="detailVisible"
      title="员工详情"
      class="employee-detail"
      width="min(1200px,calc(100vw - 32px))"
      align-center
      destroy-on-close
    >
      <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" />
      <el-skeleton v-else-if="!detail" :rows="8" animated />
      <template v-else>
        <el-tabs v-model="detailTab">
          <el-tab-pane label="基本信息" name="basic">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="员工编号">{{ detail.employeeCode }}</el-descriptions-item
              ><el-descriptions-item label="姓名">{{ detail.employeeName }}</el-descriptions-item>
              <el-descriptions-item label="部门">{{
                detail.departmentName || '—'
              }}</el-descriptions-item
              ><el-descriptions-item label="岗位">{{
                detail.positionName || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="是否转正">{{
                regularizationLabel(detail.regularized)
              }}</el-descriptions-item>
              <el-descriptions-item label="转正日期">{{
                detail.regularizationDate || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="薪酬类别">{{
                payrollCategoryLabel(detail.payrollCategory)
              }}</el-descriptions-item>
              <el-descriptions-item label="薪资生效日期">{{
                detail.salaryEffectiveFrom || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="职级">{{ detail.jobGrade || '—' }}</el-descriptions-item>
              <el-descriptions-item label="手机号">{{ detail.mobile || '—' }}</el-descriptions-item
              ><el-descriptions-item label="部门负责人">{{
                detail.departmentLeaderName || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="身份证号">{{
                detail.profile?.idNumber || '—'
              }}</el-descriptions-item
              ><el-descriptions-item label="出生日期">{{
                identity.birthDate || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="年龄">{{ identity.age || '—' }}</el-descriptions-item
              ><el-descriptions-item label="性别">{{
                identity.gender || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="入职日期">{{
                dateOnly(detail.entryDate) || '—'
              }}</el-descriptions-item
              ><el-descriptions-item label="在职状态">{{
                statusLabel(detail.employmentStatus)
              }}</el-descriptions-item>
              <el-descriptions-item label="离职日期">{{
                dateOnly(detail.leaveDate) || '—'
              }}</el-descriptions-item
              ><el-descriptions-item label="工龄">{{
                serviceLength(
                  detail.entryDate,
                  detail.employmentStatus === 'LEFT' ? detail.leaveDate : null,
                )
              }}</el-descriptions-item>
              <el-descriptions-item label="合同截止日期">{{
                detail.profile?.contractEndDate || '—'
              }}</el-descriptions-item
              ><el-descriptions-item label="学历">{{
                detail.profile?.education || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="毕业院校">{{
                detail.profile?.graduationSchool || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="专业">{{
                detail.profile?.major || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="试用期" :span="2">{{
                detail.profile?.probationPeriod || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="户籍地址">{{
                detail.profile?.registeredAddress || '—'
              }}</el-descriptions-item
              ><el-descriptions-item label="户口性质">{{
                detail.profile?.householdType || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="现居住地" :span="2">{{
                detail.profile?.residentialAddress || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="银行卡号">{{
                detail.profile?.bankAccount || '—'
              }}</el-descriptions-item
              ><el-descriptions-item label="开户行">{{
                detail.profile?.bankName || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="参保状态">{{
                detail.profile?.socialInsurance || '—'
              }}</el-descriptions-item
              ><el-descriptions-item label="邮箱">{{ detail.email || '—' }}</el-descriptions-item>
              <el-descriptions-item label="紧急联系人">{{
                detail.profile?.emergencyContact || '—'
              }}</el-descriptions-item
              ><el-descriptions-item label="紧急联系方式">{{
                detail.profile?.emergencyPhone || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="备注" :span="2">{{
                detail.remark || '—'
              }}</el-descriptions-item>
              <el-descriptions-item label="创建人">{{
                auditActor(detail.createdByName, detail.createdBy)
              }}</el-descriptions-item
              ><el-descriptions-item label="创建时间">{{
                auditTime(detail.createdTime)
              }}</el-descriptions-item>
              <el-descriptions-item label="修改人">{{
                auditActor(detail.updatedByName, detail.updatedBy)
              }}</el-descriptions-item
              ><el-descriptions-item label="修改时间">{{
                auditTime(detail.updatedTime)
              }}</el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>
          <el-tab-pane label="任职记录" name="assignments" lazy>
            <el-table :data="assignments"
              ><el-table-column prop="departmentName" label="部门" /><el-table-column
                prop="positionName"
                label="岗位"
              /><el-table-column label="开始时间"
                ><template #default="{ row }">{{
                  auditTime(row.effectiveFrom)
                }}</template></el-table-column
              ><el-table-column label="结束时间"
                ><template #default="{ row }">{{
                  row.effectiveTo ? auditTime(row.effectiveTo) : '当前任职'
                }}</template></el-table-column
              ></el-table
            >
          </el-tab-pane>
          <el-tab-pane
            v-if="can('hr:payroll-rule:read') && isCityManagerPosition(detail.positionName)"
            label="管辖城市"
            name="city-scope"
            lazy
          >
            <EmployeeCityScope
              :key="detail.employeeCode"
              :employee="detail"
              @edit="editCityScope"
            />
          </el-tab-pane>
          <el-tab-pane v-if="can('hr:payroll-rule:read')" label="薪资标准" name="salary" lazy>
            <PayrollComponentView
              :key="detail.employeeCode"
              component-kind="SALARY"
              :employee-code="detail.employeeCode"
            />
          </el-tab-pane>
          <el-tab-pane
            v-if="can('hr:payroll-rule:read')"
            label="薪资变更历史"
            name="salaryHistory"
            lazy
          >
            <PayrollComponentView
              :key="detail.employeeCode"
              component-kind="SALARY"
              :employee-code="detail.employeeCode"
              history-only
            />
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import DhbSalespersonSyncButton from '@/components/supply/DhbSalespersonSyncButton.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import DhbBindingReviewDrawer from './DhbBindingReviewDrawer.vue'
import {
  CopyDocument,
  WarningFilled,
  OfficeBuilding,
  Plus,
  Refresh,
  Search,
} from '@element-plus/icons-vue'
import { ElMessage, type TableInstance } from 'element-plus'
import DepartmentSidebar from '@/components/supply/DepartmentSidebar.vue'
import HrEmployeeEditor from './HrEmployeeEditor.vue'
import PayrollComponentView from './PayrollComponentView.vue'
import EmployeeCityScope from './components/EmployeeCityScope.vue'
import {
  getHrEmployee,
  getDhbBindingRisks,
  type DhbBindingRisk,
  getHrPositions,
  type HrPositionRecord,
  getHrEmployees,
  hrOrganizationApi,
  type HrEmployeeRecord,
  type HrDepartmentOption,
  type HrPage,
  type HrAssignment,
} from '@/api/core/hr'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  isCityManagerPosition,
  payrollCategories,
  payrollCategoryLabel,
  regularizationLabel,
} from '@/utils/hr-payroll-profile'
import {
  auditActor,
  auditTime,
  dateOnly,
  identityDetails,
  serviceLength,
} from '@/utils/hr-employee-profile'
const { can } = useSupplyPermissions()
const route = useRoute(),
  payrollMissing = ref(route.query.payrollMissing === '1')
const departmentId = ref<number | null>(null),
  includeSubDepartments = ref(true),
  departments = ref<HrDepartmentOption[]>([]),
  directoryError = ref('')
const departmentChoices = computed(() =>
  departments.value.map((d) => ({ id: d.id, parentId: d.parentId, label: d.departmentName })),
)
const risks = ref<DhbBindingRisk[]>([])
const riskError = ref(''),
  reviewVisible = ref(false),
  reviewEmployeeId = ref<string | null>(null)
const sortBy = ref('entryDate'),
  sortDirection = ref<'asc' | 'desc'>('desc')
const employeeTable = ref<TableInstance>()
const selectedDepartment = computed(() =>
  departments.value.find((d) => d.id === departmentId.value),
)
const leaderDepartments = computed(() => {
  const leaders = new Map<string, string[]>()
  for (const department of departments.value) {
    if (!department.leaderEmployeeCode) continue
    const names = leaders.get(department.leaderEmployeeCode) ?? []
    names.push(department.departmentName)
    leaders.set(department.leaderEmployeeCode, names)
  }
  return leaders
})
const sortDescription = computed(() => {
  const label =
    {
      employeeName: '姓名',
      employeeCode: '员工编号',
      entryDate: '入职时间',
      createdTime: '创建时间',
    }[sortBy.value] || '入职时间'
  return `在职优先 · ${label}${sortDirection.value === 'asc' ? '升序' : '倒序'}`
})
const positions = ref<HrPositionRecord[]>([])
const positionCode = ref(''),
  jobGrade = ref('')
const regularized = ref<boolean | undefined>(),
  payrollCategory = ref('')
const keyword = ref(''),
  status = ref(''),
  page = ref(1),
  size = ref(20),
  loading = ref(false),
  loadError = ref('')
const data = ref<HrPage<HrEmployeeRecord>>({ items: [], total: 0, begin: 0, step: 20 })
const editorVisible = ref(false),
  editing = ref<HrEmployeeRecord | null>(null),
  detailVisible = ref(false),
  detail = ref<HrEmployeeRecord | null>(null),
  detailError = ref(''),
  assignments = ref<HrAssignment[]>([])
const detailTab = ref('basic')
const editorInitialTab = ref<'basic' | 'city-scope'>('basic')
const identity = computed(() => identityDetails(detail.value?.profile?.idNumber))
let requestId = 0,
  detailRequest = 0
async function load() {
  const request = ++requestId
  loading.value = true
  loadError.value = ''
  data.value = { items: [], total: 0, begin: (page.value - 1) * size.value, step: size.value }
  try {
    const result = await getHrEmployees({
      begin: (page.value - 1) * size.value,
      step: size.value,
      keyword: keyword.value || undefined,
      employmentStatus: status.value || undefined,
      regularized: typeof regularized.value === 'boolean' ? regularized.value : undefined,
      payrollCategory: payrollCategory.value || undefined,
      payrollMissing: payrollMissing.value || undefined,
      departmentId: departmentId.value ?? undefined,
      includeSubDepartments: includeSubDepartments.value,
      positionCode: positionCode.value || undefined,
      jobGrade: jobGrade.value.trim() || undefined,
      sortBy: sortBy.value,
      sortDirection: sortDirection.value,
    })
    if (request === requestId) data.value = result
  } catch (e) {
    if (request === requestId) {
      data.value = { items: [], total: 0, begin: 0, step: size.value }
      loadError.value = e instanceof Error ? e.message : '员工加载失败'
    }
  } finally {
    if (request === requestId) loading.value = false
  }
}
function search() {
  page.value = 1
  void load()
}
function selectDepartment(id: number | null) {
  departmentId.value = id
  clearFilters()
  search()
}
function clearFilters() {
  keyword.value = ''
  status.value = ''
  regularized.value = undefined
  payrollCategory.value = ''
  payrollMissing.value = false
  positionCode.value = ''
  jobGrade.value = ''
}
function reset() {
  clearFilters()
  sortBy.value = 'entryDate'
  sortDirection.value = 'desc'
  if (employeeTable.value) employeeTable.value.sort('entryDate', 'descending')
  else search()
}
function openEditor(row?: HrEmployeeRecord, tab: 'basic' | 'city-scope' = 'basic') {
  editorInitialTab.value = tab
  editing.value = row ?? null
  editorVisible.value = true
}
function editCityScope() {
  if (!detail.value || !can('hr:employee:update') || !can('hr:payroll-rule:write')) return
  detailVisible.value = false
  openEditor(detail.value, 'city-scope')
}
function rootDepartmentId() {
  const ids = new Set(departments.value.map((d) => d.id))
  return departments.value.find((d) => d.parentId == null || !ids.has(d.parentId))?.id ?? null
}
function openReviews(id?: string) {
  reviewEmployeeId.value = id == null ? null : String(id)
  reviewVisible.value = true
}
function employeeRowClass({ row }: { row: HrEmployeeRecord }) {
  return [
    row.dhbReviewCount ? 'employee-risk-row' : '',
    row.employmentStatus === 'LEFT' ? 'employee-left-row' : '',
  ]
    .filter(Boolean)
    .join(' ')
}
function sortChanged({ prop, order }: { prop?: string | null; order?: string | null }) {
  sortBy.value = prop && order ? prop : 'entryDate'
  sortDirection.value = order === 'ascending' ? 'asc' : 'desc'
  search()
}
async function copyAccount(row: HrEmployeeRecord) {
  try {
    await navigator.clipboard.writeText(row.dhbAccountNames?.join('、') || '')
    ElMessage.success('账号已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制账号')
  }
}
async function loadRisks() {
  riskError.value = ''
  try {
    risks.value = await getDhbBindingRisks()
  } catch (e) {
    riskError.value = e instanceof Error ? e.message : '关联风险加载失败'
  }
}
async function refresh() {
  await loadDepartments()
  if (departmentId.value == null) departmentId.value = rootDepartmentId()
  await Promise.all([load(), loadRisks()])
}
async function loadDepartments() {
  directoryError.value = ''
  try {
    departments.value = await hrOrganizationApi.employeeDepartments()
    const items: HrPositionRecord[] = []
    let begin = 0
    while (true) {
      const page = await getHrPositions({ begin, step: 200 })
      items.push(...page.items)
      begin += page.items.length
      if (!page.items.length || begin >= page.total) break
    }
    positions.value = items
  } catch (e) {
    directoryError.value = e instanceof Error ? e.message : '部门树加载失败'
  }
}
async function openDetail(row: HrEmployeeRecord, tab = 'basic') {
  const request = ++detailRequest
  detailVisible.value = true
  detailTab.value = tab
  detail.value = null
  detailError.value = ''
  assignments.value = []
  try {
    const [value, history] = await Promise.all([
      getHrEmployee(row.id),
      hrOrganizationApi.assignments(String(row.id)),
    ])
    if (request === detailRequest) {
      detail.value = value
      if (tab === 'city-scope' && !isCityManagerPosition(value.positionName))
        detailTab.value = 'basic'
      assignments.value = history
    }
  } catch (e) {
    if (request === detailRequest)
      detailError.value = e instanceof Error ? e.message : '员工详情加载失败'
  }
}
function statusClass(value: string) {
  return (
    (
      {
        ACTIVE: 'is-active',
        LEFT: 'is-left',
        INACTIVE: 'is-inactive',
        PENDING: 'is-pending',
      } as Record<string, string>
    )[value] || 'is-pending'
  )
}
function statusLabel(value: string) {
  return (
    (
      { ACTIVE: '在职', LEFT: '离职', INACTIVE: '停用', PENDING: '待确认' } as Record<
        string,
        string
      >
    )[value] || value
  )
}
let linkRequest = 0
async function applyPayrollLink() {
  const request = ++linkRequest
  if (route.query.payrollMissing === '1') {
    payrollMissing.value = true
    search()
  }
  const code = route.query.cityScopeEmployeeCode
  if (typeof code === 'string' && can('hr:employee:read') && can('hr:payroll-rule:read')) {
    try {
      const result = await getHrEmployees({ begin: 0, step: 2, employeeCode: code })
      if (request !== linkRequest) return
      const row = result.items.find((item) => item.employeeCode === code)
      if (!row) throw new Error('未找到员工档案，或无权查看该员工')
      await openDetail(row, 'city-scope')
    } catch (e) {
      if (request === linkRequest) ElMessage.error(e instanceof Error ? e.message : '读取员工失败')
    }
    return
  }
  const id = route.query.payrollEmployeeId
  if (typeof id === 'string') {
    try {
      const row = await getHrEmployee(id)
      if (request !== linkRequest) return
      if (can('hr:employee:update')) openEditor(row)
      else await openDetail(row)
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '读取员工失败')
    }
  }
}
watch(
  () => [
    route.query.payrollMissing,
    route.query.payrollEmployeeId,
    route.query.cityScopeEmployeeCode,
  ],
  () => {
    void applyPayrollLink()
  },
)
onMounted(async () => {
  await refresh()
  await applyPayrollLink()
})
</script>
<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.employee-page :deep(.department-sidebar) {
  width: 208px;
  flex: 0 0 208px;
  padding: 16px 12px;
  overflow: auto;
  border-color: $color-border-base;
  border-radius: $border-radius-lg;
}
.employee-page :deep(.el-tree-node__content) {
  border-radius: 6px;
  margin: 2px 0;
  min-height: 34px;
}
.employee-page :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #eff6ff;
  color: $color-primary-dark;
  font-weight: 600;
  box-shadow: inset 3px 0 $color-primary;
}
.employee-directory-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px 14px;
  flex: none;
}
.department-context {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.department-context-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  background: #eff6ff;
  color: $color-primary;
  border-radius: 10px;
  font-size: 20px;
}
.department-context-copy {
  min-width: 0;
}
.department-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.department-title h1 {
  margin: 0;
  font-size: 18px;
  line-height: 26px;
  color: $color-text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.employee-count {
  flex: none;
  border-radius: 6px;
  background: $color-bg-muted;
  color: $color-text-secondary;
  padding: 2px 8px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.department-context-copy p {
  display: flex;
  gap: 8px;
  margin: 3px 0 0;
  color: $color-text-secondary;
  font-size: 12px;
}
.directory-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.directory-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.employee-page :deep(.order-register-filter) {
  flex: none;
  border: 0;
  background: transparent;
}
.employee-page :deep(.order-register-filter .el-card__body) {
  padding: 0 18px 14px;
}
.employee-keyword {
  width: clamp(225px, 25vw, 300px);
}
.employee-list-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px;
  border-top: 1px solid $color-border-lighter;
  color: $color-text-regular;
  font-weight: 600;
  font-size: 13px;
  flex: none;
}
.sort-hint {
  color: $color-text-secondary;
  font-size: 12px;
  font-weight: 400;
}
.employee-name {
  color: $color-text-primary;
  font-weight: 500;
}
.employee-name--leader {
  color: $color-primary-dark;
  font-weight: 750;
}
.employment-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 20px;
  font-weight: 600;
}
.employment-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.is-active {
  background: #ecfdf5;
  color: #047857;
}
.is-left {
  background: #fff1f2;
  color: #be123c;
}
.is-inactive {
  background: $color-bg-muted;
  color: $color-text-secondary;
}
.is-pending {
  background: #fffbeb;
  color: #92400e;
}
.binding-risk-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  padding: 8px 14px;
  margin: 0 18px 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
  color: #92400e;
}
.binding-risk-banner .el-button {
  margin-left: auto;
}
.dhb-account-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dhb-account {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.dhb-account-cell .el-button {
  flex: none;
}
.muted {
  color: $color-text-secondary;
}
.employee-page :deep(.employee-left-row) {
  --el-table-tr-bg-color: #fafbfc;
}
.employee-page :deep(.employee-risk-row) {
  --el-table-tr-bg-color: #fffbeb;
}

:global(.employee-detail.el-dialog) {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 48px);
  margin: 24px auto;
}
:global(.employee-detail .el-dialog__body) {
  min-height: 0;
  overflow-y: auto;
}
:global(.employee-detail .el-dialog__header) {
  flex-shrink: 0;
}

.supply-page.employee-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  font-size: 14px;
}
.employee-table-viewport {
  flex: 1;
  min-height: 0;
}
.employee-table-viewport :deep(.el-table) {
  font-size: 13px;
  --el-table-border-color: #f1f5f9;
  --el-table-header-bg-color: #f8fafc;
  --el-table-header-text-color: #64748b;
  --el-table-row-hover-bg-color: #eff6ff;
}
.employee-table-viewport :deep(.cell) {
  white-space: nowrap;
}
.employee-table-viewport :deep(.el-table__cell) {
  padding: 11px 0;
}
.employee-table-viewport :deep(.el-table__row) {
  cursor: pointer;
}
.directory-layout :deep(.department-sidebar) {
  overflow: auto;
  min-height: 0;
}
.directory-layout {
  display: flex;
  gap: 14px;
  margin-top: 0;
  min-width: 0;
  flex: 1;
  min-height: 0;
}
.employee-results {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  min-width: 0;
  padding: 0;
  background: #fff;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-lg;
  overflow: hidden;
}
.employee-list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid $color-border-lighter;
  flex: none;
}
.employee-list-footer > span {
  color: $color-text-secondary;
  font-size: 12px;
}
.el-pagination {
  margin: 0;
  flex: none;
}
.el-alert {
  margin-bottom: 16px;
}
h3 {
  font-size: 15px;
  margin: 24px 0 12px;
}
@media (max-width: 1200px) {
  .employee-directory-header {
    flex-wrap: wrap;
    gap: 12px;
  }
  .directory-actions {
    margin-left: auto;
  }
  .employee-page :deep(.order-register-filter__line) {
    flex-wrap: wrap;
  }
  .employee-page :deep(.order-register-filter__actions) {
    margin-left: 0;
  }
}
@media (max-width: 1200px) {
  .directory-layout :deep(.department-sidebar) {
    width: auto;
    flex: 0 0 auto;
    max-height: 220px;
  }
  .supply-page.employee-page {
    height: auto;
    min-height: 100%;
    overflow: visible;
  }
  .employee-table-viewport {
    flex: none;
    height: 65dvh;
  }
  .directory-layout {
    flex-direction: column;
  }
}
</style>
