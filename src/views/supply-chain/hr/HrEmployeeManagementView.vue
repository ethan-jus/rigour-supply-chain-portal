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
        <SupplyListFilters
          compact
          class="employee-filters"
          :loading="loading"
          @search="search"
          @reset="reset"
        >
          <el-form-item label="员工姓名"
            ><el-input
              v-model="employeeNameFilter"
              clearable
              placeholder="请输入员工姓名"
              aria-label="员工姓名筛选"
          /></el-form-item>
          <el-form-item label="员工编号"
            ><el-input
              v-model="employeeCodeFilter"
              clearable
              placeholder="请输入员工编号"
              aria-label="员工编号筛选"
          /></el-form-item>
          <el-form-item label="手机号"
            ><el-input
              v-model="mobileFilter"
              clearable
              placeholder="请输入手机号"
              aria-label="员工手机号筛选"
          /></el-form-item>
          <el-form-item label="订货宝账号"
            ><el-input
              v-model="dhbAccountFilter"
              clearable
              placeholder="请输入订货宝账号"
              aria-label="订货宝账号筛选"
          /></el-form-item>
          <el-form-item label="岗位"
            ><el-select
              v-model="positionCode"
              filterable
              clearable
              placeholder="全部岗位"
              aria-label="岗位"
              ><el-option
                v-for="p in positions"
                :key="p.positionCode"
                :label="p.positionName"
                :value="p.positionCode" /></el-select
          ></el-form-item>
          <el-form-item label="在职状态"
            ><el-select v-model="status" clearable placeholder="全部状态" aria-label="在职状态"
              ><el-option label="在职" value="ACTIVE" /><el-option
                label="离职"
                value="LEFT" /></el-select
          ></el-form-item>
          <el-form-item label="是否转正"
            ><el-select v-model="regularized" clearable placeholder="全部" aria-label="是否转正"
              ><el-option :value="true" label="已转正" /><el-option
                :value="false"
                label="未转正" /></el-select
          ></el-form-item>
          <el-form-item label="薪酬类别"
            ><el-select
              v-model="payrollCategory"
              clearable
              placeholder="全部类别"
              aria-label="薪酬类别"
              ><el-option
                v-for="role in payrollCategories"
                :key="role.value"
                v-bind="role" /></el-select
          ></el-form-item>
          <el-form-item label="职级"
            ><el-input v-model="jobGrade" clearable placeholder="请输入职级" aria-label="职级"
          /></el-form-item>
          <el-form-item label="薪酬档案"
            ><el-select v-model="payrollMissing" aria-label="薪酬档案完整性"
              ><el-option :value="false" label="全部档案" /><el-option
                :value="true"
                label="待完善" /></el-select
          ></el-form-item>
        </SupplyListFilters>
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
              :formatter="displayCell"
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
            <el-table-column
              prop="employmentStatus"
              label="在职状态"
              width="92"
              :formatter="displayCell"
            >
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
              :formatter="displayCell"
            >
              <template #default="{ row }">{{ row.departmentName || '-' }}</template>
            </el-table-column>
            <el-table-column
              prop="positionName"
              label="岗位"
              min-width="100"
              show-overflow-tooltip
              :formatter="displayCell"
            />
            <el-table-column
              prop="entryDate"
              label="入职时间"
              sortable="custom"
              width="120"
              :formatter="displayCell"
            >
              <template #default="{ row }">{{ dateOnly(row.entryDate) || '-' }}</template>
            </el-table-column>
            <el-table-column
              prop="mobile"
              label="手机号"
              width="125"
              show-overflow-tooltip
              :formatter="displayCell"
            />
            <el-table-column
              prop="employeeCode"
              sortable="custom"
              label="员工编号"
              width="165"
              show-overflow-tooltip
              :formatter="displayCell"
            />
            <el-table-column label="薪酬类别" width="100">
              <template #default="{ row }">{{
                payrollCategoryLabel(row.payrollCategory)
              }}</template>
            </el-table-column>
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
      class="employee-detail business-detail-panel"
      width="min(1200px,calc(100vw - 32px))"
      align-center
      destroy-on-close
    >
      <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" />
      <el-skeleton v-else-if="!detail" :rows="8" animated />
      <template v-else>
        <header class="business-detail-hero">
          <div>
            <span class="business-detail-kicker">员工档案</span>
            <h2>{{ detail.employeeName }}</h2>
          </div>
          <el-tag>{{ statusLabel(detail.employmentStatus) }}</el-tag>
        </header>
        <el-tabs v-model="detailTab">
          <el-tab-pane label="基本信息" name="basic">
            <div class="employee-detail-sections">
              <section class="employee-detail-section">
                <h3>基本资料</h3>
                <dl class="business-detail-fields">
                  <div>
                    <dt>员工编号</dt>
                    <dd>{{ detail.employeeCode }}</dd>
                  </div>
                  <div>
                    <dt>姓名</dt>
                    <dd>{{ detail.employeeName }}</dd>
                  </div>
                  <div>
                    <dt>手机号</dt>
                    <dd>{{ detail.mobile || '-' }}</dd>
                  </div>
                  <div>
                    <dt>邮箱</dt>
                    <dd>{{ detail.email || '-' }}</dd>
                  </div>
                  <div>
                    <dt>身份证号</dt>
                    <dd>{{ detail.profile?.idNumber || '-' }}</dd>
                  </div>
                  <div>
                    <dt>出生日期</dt>
                    <dd>{{ identity.birthDate || '-' }}</dd>
                  </div>
                  <div>
                    <dt>年龄</dt>
                    <dd>{{ identity.age || '-' }}</dd>
                  </div>
                  <div>
                    <dt>性别</dt>
                    <dd>{{ identity.gender || '-' }}</dd>
                  </div>
                </dl>
              </section>
              <section class="employee-detail-section">
                <h3>任职与薪酬</h3>
                <dl class="business-detail-fields">
                  <div>
                    <dt>部门</dt>
                    <dd>{{ detail.departmentName || '-' }}</dd>
                  </div>
                  <div>
                    <dt>岗位</dt>
                    <dd>{{ detail.positionName || '-' }}</dd>
                  </div>
                  <div>
                    <dt>职级</dt>
                    <dd>{{ detail.jobGrade || '-' }}</dd>
                  </div>
                  <div>
                    <dt>部门负责人</dt>
                    <dd>{{ detail.departmentLeaderName || '-' }}</dd>
                  </div>
                  <div>
                    <dt>入职日期</dt>
                    <dd>{{ dateOnly(detail.entryDate) || '-' }}</dd>
                  </div>
                  <div>
                    <dt>在职状态</dt>
                    <dd>{{ statusLabel(detail.employmentStatus) }}</dd>
                  </div>
                  <div>
                    <dt>离职日期</dt>
                    <dd>{{ dateOnly(detail.leaveDate) || '-' }}</dd>
                  </div>
                  <div>
                    <dt>工龄</dt>
                    <dd>
                      {{
                        displayValue(
                          serviceLength(
                            detail.entryDate,
                            detail.employmentStatus === 'LEFT' ? detail.leaveDate : null,
                          ),
                        )
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>是否转正</dt>
                    <dd>{{ regularizationLabel(detail.regularized) }}</dd>
                  </div>
                  <div>
                    <dt>转正日期</dt>
                    <dd>{{ detail.regularizationDate || '-' }}</dd>
                  </div>
                  <div>
                    <dt>薪酬类别</dt>
                    <dd>{{ payrollCategoryLabel(detail.payrollCategory) }}</dd>
                  </div>
                  <div>
                    <dt>薪资生效日期</dt>
                    <dd>{{ detail.salaryEffectiveFrom || '-' }}</dd>
                  </div>
                  <div>
                    <dt>试用期</dt>
                    <dd>
                      {{ displayValue(probationPeriodLabel(detail.profile?.probationPeriod)) }}
                    </dd>
                  </div>
                </dl>
              </section>
              <section class="employee-detail-section">
                <h3>教育与联系</h3>
                <dl class="business-detail-fields">
                  <div>
                    <dt>学历</dt>
                    <dd>{{ detail.profile?.education || '-' }}</dd>
                  </div>
                  <div>
                    <dt>毕业院校</dt>
                    <dd>{{ detail.profile?.graduationSchool || '-' }}</dd>
                  </div>
                  <div>
                    <dt>专业</dt>
                    <dd>{{ detail.profile?.major || '-' }}</dd>
                  </div>
                  <div>
                    <dt>户籍地址</dt>
                    <dd>{{ detail.profile?.registeredAddress || '-' }}</dd>
                  </div>
                  <div>
                    <dt>户口性质</dt>
                    <dd>{{ detail.profile?.householdType || '-' }}</dd>
                  </div>
                  <div>
                    <dt>现居住地</dt>
                    <dd>{{ detail.profile?.residentialAddress || '-' }}</dd>
                  </div>
                  <div>
                    <dt>紧急联系人</dt>
                    <dd>{{ detail.profile?.emergencyContact || '-' }}</dd>
                  </div>
                  <div>
                    <dt>紧急联系方式</dt>
                    <dd>{{ detail.profile?.emergencyPhone || '-' }}</dd>
                  </div>
                </dl>
              </section>
              <section class="employee-detail-section">
                <h3>合同与收款</h3>
                <dl class="business-detail-fields">
                  <div>
                    <dt>合同截止日期</dt>
                    <dd>{{ detail.profile?.contractEndDate || '-' }}</dd>
                  </div>
                  <div>
                    <dt>参保状态</dt>
                    <dd>{{ detail.profile?.socialInsurance || '-' }}</dd>
                  </div>
                  <div>
                    <dt>银行卡号</dt>
                    <dd>{{ detail.profile?.bankAccount || '-' }}</dd>
                  </div>
                  <div>
                    <dt>开户行</dt>
                    <dd>{{ detail.profile?.bankName || '-' }}</dd>
                  </div>
                </dl>
              </section>
              <section class="employee-detail-section">
                <h3>系统记录</h3>
                <dl class="business-detail-fields">
                  <div>
                    <dt>备注</dt>
                    <dd>{{ detail.remark || '-' }}</dd>
                  </div>
                  <div>
                    <dt>创建人</dt>
                    <dd>{{ auditActor(detail.createdByName, detail.createdBy) }}</dd>
                  </div>
                  <div>
                    <dt>创建时间</dt>
                    <dd>{{ auditTime(detail.createdTime) }}</dd>
                  </div>
                  <div>
                    <dt>修改人</dt>
                    <dd>{{ auditActor(detail.updatedByName, detail.updatedBy) }}</dd>
                  </div>
                  <div>
                    <dt>修改时间</dt>
                    <dd>{{ auditTime(detail.updatedTime) }}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </el-tab-pane>
          <el-tab-pane label="订货宝关联" name="dhb" lazy>
            <el-table
              :data="(detail.dhbAccountNames ?? []).map((account) => ({ account }))"
              empty-text="暂无关联账号"
              ><el-table-column prop="account" label="订货宝账号" :formatter="displayCell"
            /></el-table>
            <el-button v-if="detail.dhbAccountNames?.length" @click="copyAccount(detail)"
              >复制全部账号</el-button
            >
          </el-tab-pane>
          <el-tab-pane label="任职记录" name="assignments" lazy>
            <el-table :data="assignments"
              ><el-table-column
                prop="departmentName"
                label="部门"
                :formatter="displayCell"
              /><el-table-column
                prop="positionName"
                label="岗位"
                :formatter="displayCell"
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
import { displayCell, displayValue } from '@/utils/business-display'
import DhbSalespersonSyncButton from '@/components/supply/DhbSalespersonSyncButton.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import SupplyListFilters from '@/components/supply/SupplyListFilters.vue'
import DhbBindingReviewDrawer from './DhbBindingReviewDrawer.vue'
import { WarningFilled, OfficeBuilding, Plus, Refresh } from '@element-plus/icons-vue'
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
import { displayRecordDateTime as auditTime } from '@/utils/business-display'
import { displayRecordActor } from '@/utils/business-display'
import {
  probationPeriodLabel,
  employeeEmploymentStatusLabel,
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
const employeeNameFilter = ref(''),
  employeeCodeFilter = ref(''),
  mobileFilter = ref(''),
  dhbAccountFilter = ref(''),
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
      employeeName: employeeNameFilter.value.trim() || undefined,
      employeeCode: employeeCodeFilter.value.trim() || undefined,
      mobile: mobileFilter.value.trim() || undefined,
      dhbAccount: dhbAccountFilter.value.trim() || undefined,
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
  employeeNameFilter.value = ''
  employeeCodeFilter.value = ''
  mobileFilter.value = ''
  dhbAccountFilter.value = ''
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
      } as Record<string, string>
    )[value] || 'is-unset'
  )
}
function statusLabel(value: string) {
  return displayValue(employeeEmploymentStatusLabel(value))
}
function auditActor(name?: string | null, id?: string | null) {
  return name?.trim() || displayRecordActor(id)
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
  font-size: var(--app-font-size-base);
  font-variant-numeric: tabular-nums;
}
.department-context-copy p {
  display: flex;
  gap: 8px;
  margin: 3px 0 0;
  color: $color-text-secondary;
  font-size: var(--app-font-size-base);
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
.employee-filters {
  padding: 0 18px;
}
.employee-filters :deep(.supply-list-filters__form) {
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
}
.employee-detail-sections {
  display: grid;
  gap: 16px;
}
.employee-detail-section {
  padding: 18px 20px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: white;
}
.employee-detail-section h3 {
  margin: 0 0 18px;
  font-size: 15px;
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
  font-size: var(--app-font-size-base);
  flex: none;
}
.sort-hint {
  color: $color-text-secondary;
  font-size: var(--app-font-size-base);
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
  font-size: var(--app-font-size-base);
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
.is-unset {
  background: $color-bg-muted;
  color: $color-text-secondary;
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
  font-size: var(--app-font-size-base);
}
.employee-table-viewport {
  flex: 1;
  min-height: 0;
}
.employee-table-viewport :deep(.el-table) {
  font-size: var(--app-font-size-base);
  --el-table-border-color: #f1f5f9;
  --el-table-header-bg-color: #f8fafc;
  --el-table-header-text-color: var(--app-table-header-color);
  --el-table-row-hover-bg-color: #eff6ff;
}
.employee-table-viewport :deep(.cell) {
  white-space: nowrap;
}
.employee-table-viewport :deep(.el-table__cell) {
  padding: 6px 0;
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
  font-size: var(--app-font-size-base);
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
