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
      <section class="employee-results">
        <OrderRegisterFilterCard :loading="loading" query-first @search="search" @reset="reset">
          <template #primary>
            <el-input
              v-model="keyword"
              clearable
              aria-label="关键词"
              placeholder="姓名 / 手机号 / 员工编号 / 订货宝账号"
              style="width: 300px"
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
            <el-input
              v-model="jobGrade"
              clearable
              aria-label="职级"
              placeholder="职级"
              style="width: 110px"
            />
          </template>
          <template #actions>
            <DhbSalespersonSyncButton @completed="refresh" />
            <el-button :loading="loading" @click="refresh">刷新</el-button>
            <el-button v-if="can('hr:employee:create')" type="primary" @click="openEditor()"
              >新增员工</el-button
            >
          </template>
        </OrderRegisterFilterCard>
        <el-alert v-if="riskError" :title="riskError" type="error" :closable="false" />
        <div v-if="risks.length" class="binding-risk-banner" role="status">
          <el-icon><WarningFilled /></el-icon><strong>{{ risks.length }} 条关联待确认</strong>
          <span>来源姓名或手机号与员工档案不一致，请核对关联</span>
          <el-button link type="primary" @click="openReviews()">查看并处理</el-button>
        </div>
        <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
        <div class="employee-table-viewport">
          <el-table
            v-loading="loading"
            :data="data.items"
            row-key="id"
            border
            height="100%"
            :default-sort="{ prop: 'createdTime', order: 'descending' }"
            :row-class-name="employeeRowClass"
            @sort-change="sortChanged"
            @row-click="openDetail"
          >
            <el-table-column
              prop="employeeCode"
              sortable="custom"
              label="员工编号"
              width="160"
              fixed="left"
              show-overflow-tooltip
            />
            <el-table-column
              prop="employeeName"
              sortable="custom"
              label="姓名"
              width="80"
              fixed="left"
              show-overflow-tooltip
            />
            <el-table-column prop="departmentName" label="部门" min-width="81" show-overflow-tooltip
              ><template #default="{ row }">{{
                row.departmentName || '未分配部门'
              }}</template></el-table-column
            >
            <el-table-column prop="mobile" label="手机号" width="125" show-overflow-tooltip />
            <!-- @vue-generic {HrEmployeeRecord} -->
            <el-table-column label="订货宝账号" min-width="176" show-overflow-tooltip>
              <template #default="{ row }"
                ><span class="dhb-account">{{ row.dhbAccountNames?.join('、') || '—' }}</span>
                <el-button
                  v-if="row.dhbAccountNames?.length"
                  link
                  aria-label="复制订货宝账号"
                  @click.stop="copyAccount(row)"
                  ><el-icon><CopyDocument /></el-icon
                ></el-button>
              </template>
            </el-table-column>
            <el-table-column
              prop="positionName"
              label="岗位"
              min-width="90"
              show-overflow-tooltip
            />
            <el-table-column prop="entryDate" label="入职时间" sortable="custom" width="110"
              ><template #default="{ row }">{{
                dateOnly(row.entryDate) || '—'
              }}</template></el-table-column
            >
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
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="data.total"
          :page-sizes="[20, 50, 100]"
          layout="total,sizes,prev,pager,next"
          @current-change="load"
          @size-change="search"
        />
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
      @saved="load"
    />
    <el-dialog
      v-model="detailVisible"
      title="员工详情"
      class="employee-detail"
      width="min(1000px,calc(100vw - 32px))"
      align-center
    >
      <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" />
      <el-skeleton v-else-if="!detail" :rows="8" animated />
      <template v-else>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="员工编号">{{ detail.employeeCode }}</el-descriptions-item
          ><el-descriptions-item label="姓名">{{ detail.employeeName }}</el-descriptions-item>
          <el-descriptions-item label="部门">{{
            detail.departmentName || '—'
          }}</el-descriptions-item
          ><el-descriptions-item label="岗位">{{
            detail.positionName || '—'
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
          ><el-descriptions-item label="性别">{{ identity.gender || '—' }}</el-descriptions-item>
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
          <el-descriptions-item label="转正薪资">{{
            detail.profile?.regularSalary || '—'
          }}</el-descriptions-item>
          <el-descriptions-item label="试用期薪资">{{
            detail.profile?.probationSalary || '—'
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
        <h3>任职历史</h3>
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
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import DhbSalespersonSyncButton from '@/components/supply/DhbSalespersonSyncButton.vue'
import { computed, onMounted, ref } from 'vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import DhbBindingReviewDrawer from './DhbBindingReviewDrawer.vue'
import { CopyDocument, WarningFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import DepartmentSidebar from '@/components/supply/DepartmentSidebar.vue'
import HrEmployeeEditor from './HrEmployeeEditor.vue'
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
  auditActor,
  auditTime,
  dateOnly,
  identityDetails,
  serviceLength,
} from '@/utils/hr-employee-profile'
const { can } = useSupplyPermissions()
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
const sortBy = ref('createdTime'),
  sortDirection = ref<'asc' | 'desc'>('desc')
const positions = ref<HrPositionRecord[]>([])
const positionCode = ref(''),
  jobGrade = ref('')
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
const identity = computed(() => identityDetails(detail.value?.profile?.idNumber))
let requestId = 0,
  detailRequest = 0
async function load() {
  const request = ++requestId
  loading.value = true
  loadError.value = ''
  try {
    const result = await getHrEmployees({
      begin: (page.value - 1) * size.value,
      step: size.value,
      keyword: keyword.value || undefined,
      employmentStatus: status.value || undefined,
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
  search()
}
function reset() {
  keyword.value = ''
  status.value = ''
  positionCode.value = ''
  jobGrade.value = ''
  includeSubDepartments.value = true
  departmentId.value = rootDepartmentId()
  search()
}
function openEditor(row?: HrEmployeeRecord) {
  editing.value = row ?? null
  editorVisible.value = true
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
  return row.dhbReviewCount ? 'employee-risk-row' : ''
}
function sortChanged({ prop, order }: { prop?: string | null; order?: string | null }) {
  sortBy.value = prop && order ? prop : 'createdTime'
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
async function openDetail(row: HrEmployeeRecord) {
  const request = ++detailRequest
  detailVisible.value = true
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
      assignments.value = history
    }
  } catch (e) {
    if (request === detailRequest)
      detailError.value = e instanceof Error ? e.message : '员工详情加载失败'
  }
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
onMounted(refresh)
</script>
<style scoped>
.employee-page :deep(.department-sidebar) {
  width: 218px;
  flex-basis: 218px;
  overflow: auto;
}
.employee-page :deep(.order-register-filter) {
  flex: none;
  border: 0;
  background: transparent;
}
.employee-page :deep(.order-register-filter .el-card__body) {
  padding: 0 0 12px;
}
.binding-risk-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  padding: 8px 14px;
  margin-bottom: 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
  color: #92400e;
}
.binding-risk-banner .el-button {
  margin-left: auto;
}
.dhb-account {
  font-variant-numeric: tabular-nums;
}
.muted {
  color: #94a3b8;
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
  margin-top: 12px;
}
.employee-table-viewport :deep(.el-table) {
  font-size: 14px;
}
.employee-table-viewport :deep(.cell) {
  white-space: nowrap;
}
.employee-table-viewport :deep(.el-table__cell) {
  padding: 12px 0;
}
.directory-layout :deep(.department-sidebar) {
  overflow: auto;
  min-height: 0;
}
.directory-layout {
  display: flex;
  gap: 16px;
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
  border: 0;
}
.el-pagination {
  margin-top: 16px;
  flex: none;
}
.el-alert {
  margin-bottom: 16px;
}
h3 {
  font-size: 15px;
  margin: 24px 0 12px;
}
@media (max-width: 900px) {
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
