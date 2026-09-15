<template>
  <div class="hr-employee-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">HR · 员工主数据</span>
        <h1>员工主档</h1>
        <p>统一查看员工身份、岗位职位、区域城市、leader 和来源信息。</p>
      </div>
      <div class="heading-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadEmployees">刷新</el-button>
      </div>
    </div>

    <section class="metric-grid" aria-label="员工主档概览">
      <div class="metric-item">
        <span>当前查询</span>
        <strong>{{ pageData.total }}</strong>
      </div>
      <div class="metric-item">
        <span>当前页在职</span>
        <strong>{{ activeCount }}</strong>
      </div>
      <div class="metric-item">
        <span>当前页飞书来源</span>
        <strong>{{ feishuCount }}</strong>
      </div>
      <div class="metric-item">
        <span>区域/城市</span>
        <strong>{{ coverageCount }}</strong>
      </div>
    </section>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="submitSearch">
        <el-form-item label="关键字">
          <el-input
            v-model="filters.keyword"
            clearable
            placeholder="姓名/员工编码/手机号"
            :prefix-icon="Search"
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="员工状态">
          <el-select v-model="filters.employmentStatus" clearable placeholder="全部状态" style="width: 140px">
            <el-option label="在职" value="ACTIVE" />
            <el-option label="离职" value="LEFT" />
            <el-option label="停用" value="INACTIVE" />
          </el-select>
        </el-form-item>
        <el-form-item label="岗位">
          <el-select v-model="filters.jobCategory" clearable filterable placeholder="全部岗位" style="width: 140px">
            <el-option
              v-for="item in jobCategoryOptions"
              :key="item.positionCode"
              :label="item.positionName"
              :value="item.positionName"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="职位">
          <el-select v-model="filters.positionName" clearable filterable placeholder="全部职位" style="width: 160px">
            <el-option
              v-for="item in positionTitleOptions"
              :key="item.positionCode"
              :label="item.positionName"
              :value="item.positionName"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="filters.regionName" clearable filterable placeholder="全部区域" style="width: 150px">
            <el-option
              v-for="item in regionOptions"
              :key="item.code"
              :label="item.name"
              :value="item.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="城市">
          <el-select v-model="filters.cityName" clearable filterable placeholder="全部城市" style="width: 130px">
            <el-option
              v-for="item in cityOptions"
              :key="item.code"
              :label="areaOptionLabel(item)"
              :value="item.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="filters.sourceSystem" clearable placeholder="全部来源" style="width: 140px">
            <el-option label="飞书" value="FEISHU" />
            <el-option label="订货宝" value="DINGHUOBAO" />
            <el-option label="人工维护" value="MANUAL" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :icon="Search" :loading="loading" native-type="submit">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="result-heading">
      <div>
        <div class="result-title-line">
          <h2>员工列表</h2>
          <span class="result-count"><strong>{{ pageData.total }}</strong> 条</span>
        </div>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <el-table
        class="business-table supply-scroll-table"
        v-loading="loading"
        :data="pageData.items"
        row-key="id"
        border
        max-height="620"
        @row-click="openDetail"
      >
        <el-table-column type="index" label="序号" width="76" fixed="left" :index="tableRowIndex" />
        <el-table-column prop="employeeCode" label="员工编码" width="170" fixed="left" show-overflow-tooltip />
        <el-table-column prop="employeeName" label="姓名" min-width="140" fixed="left" show-overflow-tooltip>
          <template #default="scope">
            <span class="record-name">{{ scope.row.employeeName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="mobile" label="手机号" min-width="140" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.mobile || '-' }}</template>
        </el-table-column>
        <el-table-column prop="employmentStatus" label="状态" width="110">
          <template #default="scope">
            <el-tag :type="statusTag(scope.row.employmentStatus)" effect="light">
              {{ statusLabel(scope.row.employmentStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="jobCategory" label="岗位" min-width="120" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.jobCategory || '-' }}</template>
        </el-table-column>
        <el-table-column prop="positionName" label="职位" min-width="140" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.positionName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="regionName" label="区域" min-width="130" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.regionName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="cityName" label="城市" min-width="110" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.cityName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="leaderName" label="直属 leader" min-width="140" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.leaderName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="sourceSystem" label="来源" width="110">
          <template #default="scope">
            <el-tag :type="sourceTag(scope.row.sourceSystem)" effect="plain">
              {{ sourceLabel(scope.row.sourceSystem) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源创建时间" width="170">
          <template #default="scope">{{ formatTime(scope.row.sourceCreatedAt) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="scope">{{ formatTime(scope.row.updatedTime) }}</template>
        </el-table-column>
        <!-- @vue-generic {HrEmployeeRecord} -->
        <el-table-column label="操作" width="96" fixed="right" align="center">
          <template #default="scope">
            <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无员工主档" />
        </template>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="pageData.total"
          @current-change="loadEmployees"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" class="employee-detail-drawer" size="min(760px, 92vw)" :with-header="false">
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>员工详情</span>
            <h2>{{ detail.employeeName }}</h2>
            <p>{{ detail.employeeCode }} · {{ statusLabel(detail.employmentStatus) }}</p>
          </div>
          <el-button :icon="Close" circle plain aria-label="关闭员工详情" @click="detailVisible = false" />
        </header>
        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="员工编码">{{ detail.employeeCode }}</el-descriptions-item>
            <el-descriptions-item label="姓名">{{ detail.employeeName }}</el-descriptions-item>
            <el-descriptions-item label="手机号">{{ detail.mobile || '-' }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ detail.email || '-' }}</el-descriptions-item>
            <el-descriptions-item label="岗位">{{ detail.jobCategory || '-' }}</el-descriptions-item>
            <el-descriptions-item label="职位">{{ detail.positionName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="部门">{{ detail.departmentName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="直属 leader">{{ detail.leaderName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="区域">{{ detail.regionName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="城市">{{ detail.cityName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="来源">{{ sourceLabel(detail.sourceSystem) }}</el-descriptions-item>
            <el-descriptions-item label="来源单号">{{ detail.sourceDocumentNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="来源创建时间">{{ formatTime(detail.sourceCreatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="来源更新时间">{{ formatTime(detail.sourceUpdatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="入职时间">{{ formatTime(detail.entryDate) }}</el-descriptions-item>
            <el-descriptions-item label="离职时间">{{ formatTime(detail.leaveDate) }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(detail.updatedTime) }}</el-descriptions-item>
            <el-descriptions-item label="版本">{{ detail.revision ?? '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      <el-skeleton v-else :rows="8" animated />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, Refresh, Search } from '@element-plus/icons-vue'
import {
  getHrEmployee,
  getHrEmployees,
  getHrPositions,
  type HrEmployeeRecord,
  type HrPage,
  type HrPositionRecord,
} from '@/api/core/hr'
import { getCrmCustomerAreas, type CrmDictionaryView } from '@/api/core/crm'

const loading = ref(false)
const detailVisible = ref(false)
const detail = ref<HrEmployeeRecord | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<HrPage<HrEmployeeRecord>>({ total: 0, begin: 0, step: 20, items: [] })
const positionOptions = ref<HrPositionRecord[]>([])
const crmAreaOptions = ref<CrmDictionaryView[]>([])

const filters = reactive({
  keyword: '',
  employmentStatus: '',
  jobCategory: '',
  positionName: '',
  regionName: '',
  cityName: '',
  sourceSystem: '',
})

const activeCount = computed(() => pageData.value.items.filter((item) => item.employmentStatus === 'ACTIVE').length)
const feishuCount = computed(() => pageData.value.items.filter((item) => item.sourceSystem === 'FEISHU').length)
const jobCategoryOptions = computed(() => positionOptions.value.filter((item) => (
  item.positionType === 'JOB_CATEGORY' && item.statusCode === 'ACTIVE'
)))
const positionTitleOptions = computed(() => positionOptions.value.filter((item) => (
  item.positionType === 'JOB_TITLE' && item.statusCode === 'ACTIVE'
)))
const regionOptions = computed(() => crmAreaOptions.value.filter((item) => (
  item.status === 'ACTIVE' && !item.parentCode
)))
const cityOptions = computed(() => crmAreaOptions.value.filter((item) => item.status === 'ACTIVE'))
const coverageCount = computed(() => {
  const values = new Set<string>()
  for (const item of pageData.value.items) {
    if (item.regionName || item.cityName) values.add(`${item.regionName || '-'}:${item.cityName || '-'}`)
  }
  return values.size
})

onMounted(() => {
  void Promise.all([loadEmployees(), loadMasterOptions()])
})

async function loadEmployees() {
  loading.value = true
  try {
    pageData.value = await getHrEmployees({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      keyword: empty(filters.keyword),
      employmentStatus: empty(filters.employmentStatus),
      jobCategory: empty(filters.jobCategory),
      positionName: empty(filters.positionName),
      regionName: empty(filters.regionName),
      cityName: empty(filters.cityName),
      sourceSystem: empty(filters.sourceSystem),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '员工主档加载失败'))
  } finally {
    loading.value = false
  }
}

async function loadMasterOptions() {
  try {
    const [positions, areas] = await Promise.all([
      getHrPositions({ begin: 0, step: 200, statusCode: 'ACTIVE' }),
      getCrmCustomerAreas({ begin: 0, step: 200 }),
    ])
    positionOptions.value = positions.items
    crmAreaOptions.value = areas.items
  } catch (reason) {
    ElMessage.warning(errorMessage(reason, '岗位职位或区域城市下拉加载失败'))
  }
}

function submitSearch() {
  currentPage.value = 1
  void loadEmployees()
}

function resetFilters() {
  filters.keyword = ''
  filters.employmentStatus = ''
  filters.jobCategory = ''
  filters.positionName = ''
  filters.regionName = ''
  filters.cityName = ''
  filters.sourceSystem = ''
  currentPage.value = 1
  void loadEmployees()
}

function handleSizeChange() {
  currentPage.value = 1
  void loadEmployees()
}

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

async function openDetail(row: HrEmployeeRecord) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getHrEmployee(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '员工详情加载失败'))
  }
}

function statusLabel(value: string | null | undefined) {
  if (value === 'ACTIVE') return '在职'
  if (value === 'LEFT') return '离职'
  if (value === 'INACTIVE') return '停用'
  if (value === 'PENDING') return '待确认'
  return value || '-'
}

function statusTag(value: string | null | undefined) {
  if (value === 'ACTIVE') return 'success'
  if (value === 'INACTIVE') return 'info'
  return 'warning'
}

function sourceLabel(value: string | null | undefined) {
  if (value === 'FEISHU') return '飞书'
  if (value === 'DINGHUOBAO') return '订货宝'
  if (value === 'MANUAL') return '人工维护'
  return value || '-'
}

function sourceTag(value: string | null | undefined) {
  if (value === 'FEISHU') return 'success'
  if (value === 'DINGHUOBAO') return 'warning'
  return 'info'
}

function areaOptionLabel(item: CrmDictionaryView) {
  if (!item.parentCode) return item.name
  const parent = crmAreaOptions.value.find((row) => row.code === item.parentCode)
  return parent ? `${parent.name} / ${item.name}` : item.name
}

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

function formatTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}
</script>

<style scoped lang="scss">
.hr-employee-page {
  min-height: 0;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.metric-item {
  min-height: 88px;
  padding: 18px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;

  span {
    display: block;
    color: #64748b;
    font-size: 13px;
  }

  strong {
    display: block;
    margin-top: 10px;
    color: #0f172a;
    font-size: 28px;
    line-height: 1;
  }
}

.list-card {
  margin-top: 12px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 14px;
}

.record-name {
  color: #0f172a;
  font-weight: 700;
}

:deep(.employee-detail-drawer .el-drawer__body) {
  padding: 0;
}

.detail-shell {
  min-height: 100%;
  background: #f8fafc;
}

.detail-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;

  span {
    color: #0f766e;
    font-size: 13px;
    font-weight: 700;
  }

  h2 {
    margin: 6px 0;
    color: #0f172a;
    font-size: 24px;
  }

  p {
    margin: 0;
    color: #64748b;
  }
}

.detail-content {
  padding: 20px 24px 28px;
}

@media (max-width: 980px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
