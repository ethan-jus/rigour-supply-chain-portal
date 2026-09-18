<template>
  <div class="supply-page employee-page">
    <header class="heading">
      <div>
        <SupplyPageTitle>员工档案</SupplyPageTitle>
        <p>按部门维护员工档案，选择部门包含其下级部门。</p>
      </div>
      <div>
        <el-button @click="refresh" :loading="loading">刷新</el-button
        ><el-button v-if="can('hr:employee:create')" type="primary" @click="openEditor()"
          >新增员工</el-button
        >
      </div>
    </header>
    <el-alert v-if="directoryError" :title="directoryError" type="error" :closable="false" />
    <div class="directory-layout">
      <DepartmentSidebar
        :departments="departmentChoices"
        :model-value="departmentId"
        @update:model-value="selectDepartment"
      />
      <section class="employee-results">
        <el-form class="employee-filters" label-position="top" @submit.prevent="search"
          ><el-form-item label="关键词"
            ><el-input v-model="keyword" clearable placeholder="员工编号 / 姓名 / 手机号"
          /></el-form-item>
          <el-form-item label="部门">
            <el-tree-select
              v-model="departmentId"
              :data="departmentTree"
              node-key="id"
              :props="{ label: 'label', children: 'children' }"
              check-strictly
              filterable
              clearable
              placeholder="全部部门（含下级）"
              @change="selectDepartment(departmentId ?? null)"
            />
          </el-form-item>
          <el-form-item label="岗位">
            <el-select v-model="positionCode" filterable clearable placeholder="全部岗位">
              <el-option
                v-for="p in positions"
                :key="p.positionCode"
                :label="p.positionName"
                :value="p.positionCode"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="职级"
            ><el-input v-model="jobGrade" clearable placeholder="例如 S1"
          /></el-form-item>
          <el-form-item label="在职状态"
            ><el-select v-model="status" clearable placeholder="全部状态"
              ><el-option label="在职" value="ACTIVE" /><el-option
                label="离职"
                value="LEFT" /><el-option label="停用" value="INACTIVE" /><el-option
                label="待确认"
                value="PENDING" /></el-select
          ></el-form-item>
          <div class="filter-actions">
            <el-button type="primary" native-type="submit">查询</el-button
            ><el-button @click="reset">重置</el-button>
          </div></el-form
        >
        <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
        <div class="employee-table-viewport">
          <el-table
            v-loading="loading"
            :data="data.items"
            row-key="id"
            border
            height="100%"
            @row-click="openDetail"
          >
            <el-table-column
              prop="employeeCode"
              label="员工编号"
              width="180"
              fixed="left"
              show-overflow-tooltip
            />
            <el-table-column
              prop="employeeName"
              label="姓名"
              width="110"
              fixed="left"
              show-overflow-tooltip
            />
            <el-table-column prop="employmentStatus" label="在职状态" width="104" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="statusTagType(row.employmentStatus)"
                  class="employment-status"
                  :class="`employment-status--${row.employmentStatus.toLowerCase()}`"
                  >{{ statusLabel(row.employmentStatus) }}</el-tag
                >
              </template>
            </el-table-column>
            <el-table-column
              prop="departmentName"
              label="部门"
              min-width="170"
              show-overflow-tooltip
              ><template #default="{ row }">{{
                row.departmentName || '未分配部门'
              }}</template></el-table-column
            >
            <el-table-column prop="mobile" label="手机号" width="140" />
            <el-table-column prop="positionName" label="岗位" min-width="130" />
            <el-table-column prop="jobGrade" label="职级" width="100" />
            <el-table-column prop="departmentLeaderName" label="部门负责人" width="130" />
            <el-table-column label="创建人" min-width="140" show-overflow-tooltip
              ><template #default="{ row }">{{
                auditActor(row.createdByName, row.createdBy)
              }}</template></el-table-column
            >
            <el-table-column label="创建时间" width="185"
              ><template #default="{ row }">{{
                auditTime(row.createdTime)
              }}</template></el-table-column
            >
            <el-table-column label="修改人" min-width="140" show-overflow-tooltip
              ><template #default="{ row }">{{
                auditActor(row.updatedByName, row.updatedBy)
              }}</template></el-table-column
            >
            <el-table-column label="修改时间" width="185"
              ><template #default="{ row }">{{
                auditTime(row.updatedTime)
              }}</template></el-table-column
            >
            <!-- @vue-generic {HrEmployeeRecord} -->
            <el-table-column label="操作" width="135" fixed="right"
              ><template #default="{ row }"
                ><el-button link type="primary" @click.stop="openDetail(row)">详情</el-button
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
import { computed, onMounted, ref } from 'vue'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import DepartmentSidebar from '@/components/supply/DepartmentSidebar.vue'
import HrEmployeeEditor from './HrEmployeeEditor.vue'
import {
  getHrEmployee,
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
  departments = ref<HrDepartmentOption[]>([]),
  directoryError = ref('')
const departmentChoices = computed(() =>
  departments.value.map((d) => ({ id: d.id, parentId: d.parentId, label: d.departmentName })),
)
type DepartmentNode = { id: number; label: string; children: DepartmentNode[] }
const departmentTree = computed(() => {
  const map = new Map(
    departmentChoices.value.map((d) => [d.id, { ...d, children: [] as DepartmentNode[] }]),
  )
  const roots: DepartmentNode[] = []
  for (const d of departmentChoices.value) {
    const node = map.get(d.id)!
    const parent = d.parentId == null ? null : map.get(d.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
})
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
      positionCode: positionCode.value || undefined,
      jobGrade: jobGrade.value.trim() || undefined,
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
  departmentId.value = null
  search()
}
function openEditor(row?: HrEmployeeRecord) {
  editing.value = row ?? null
  editorVisible.value = true
}
async function refresh() {
  await Promise.all([load(), loadDepartments()])
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
function statusTagType(value: string) {
  switch (value) {
    case 'ACTIVE':
      return 'success'
    case 'LEFT':
      return 'info'
    case 'INACTIVE':
      return 'danger'
    default:
      return 'warning'
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
.employment-status {
  min-width: 56px;
  font-weight: 600;
}
.employment-status--active {
  --el-tag-bg-color: #f0fdf4;
  --el-tag-border-color: #bbf7d0;
  --el-tag-text-color: #15803d;
}
.employment-status--left {
  --el-tag-bg-color: #f1f5f9;
  --el-tag-border-color: #cbd5e1;
  --el-tag-text-color: #475569;
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
.employee-filters {
  display: grid;
  grid-template-columns: minmax(210px, 1.3fr) repeat(4, minmax(130px, 1fr)) auto;
  gap: 12px 16px;
  align-items: end;
  flex: none;
}
.employee-filters :deep(.el-form-item) {
  margin: 0;
}
.employee-page :deep(.el-form-item__label) {
  font-size: 14px;
}
.employee-filters :deep(.el-select),
.employee-filters :deep(.el-tree-select) {
  width: 100%;
}
.filter-actions {
  display: flex;
  padding-bottom: 1px;
}
.employee-table-viewport {
  flex: 1;
  min-height: 0;
  margin-top: 18px;
}
.employee-table-viewport :deep(.el-table) {
  font-size: 14px;
}
.employee-table-viewport :deep(.el-table__cell) {
  padding: 12px 0;
}
.directory-layout :deep(.department-sidebar) {
  overflow: auto;
  min-height: 0;
}
@media (max-width: 1600px) {
  .employee-filters {
    grid-template-columns: repeat(3, minmax(140px, 1fr));
  }
}

.heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
  flex: none;
}
.heading p {
  color: #64748b;
  font-size: 13px;
  margin-top: 8px;
}
.directory-layout {
  display: flex;
  gap: 18px;
  margin-top: 18px;
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
  padding: 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
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
  .supply-page.employee-page {
    height: auto;
    min-height: 100%;
    overflow: visible;
  }
  .employee-table-viewport {
    flex: none;
    height: 65dvh;
  }
  .employee-filters {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }
  .directory-layout {
    flex-direction: column;
  }
  .heading {
    align-items: flex-start;
    gap: 12px;
  }
}
</style>
