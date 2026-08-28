<template>
  <div class="customer-management-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">CRM · 客户中心</span>
        <h1>客户管理</h1>
        <p>维护客户档案、联系方式、归属地区和归属销售。</p>
      </div>
      <div class="heading-actions">
        <el-button type="primary" @click="openCreate">新增客户</el-button>
      </div>
    </div>

    <div class="workflow-strip" aria-label="客户管理业务流程">
      <div class="workflow-step is-active">
        <span>1</span>
        <strong>建立客户档案</strong>
        <small>客户名称就是门店/商家名称</small>
      </div>
      <div class="workflow-step">
        <span>2</span>
        <strong>维护联系方式</strong>
        <small>联系人、电话、地址</small>
      </div>
      <div class="workflow-step">
        <span>3</span>
        <strong>配置归属</strong>
        <small>归属地区、归属销售</small>
      </div>
      <div class="workflow-step">
        <span>4</span>
        <strong>销售订单引用</strong>
        <small>订单保存客户快照</small>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="submitSearch">
        <el-form-item label="客户编号">
          <el-input v-model="filters.customerCode" clearable placeholder="系统生成的客户编号" style="width: 180px" />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="filters.customerName" clearable placeholder="门店/商家名称" style="width: 220px" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="filters.contactPhone" clearable placeholder="手机号/固定电话" style="width: 180px" />
        </el-form-item>
        <el-form-item label="客户类型">
          <el-select v-model="filters.customerTypeCode" clearable filterable placeholder="全部类型" style="width: 160px">
            <el-option v-for="item in customerTypeOptions" :key="item.code" :label="item.name" :value="item.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="归属地区">
          <el-select v-model="filters.regionCode" clearable filterable placeholder="全部地区" style="width: 160px">
            <el-option v-for="item in customerAreaOptions" :key="item.code" :label="areaOptionLabel(item)" :value="item.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="归属销售人员">
          <el-select
            v-model="filters.ownerStaffCode"
            clearable
            filterable
            remote
            reserve-keyword
            placeholder="搜索姓名/员工编码"
            :remote-method="searchSalesStaff"
            :loading="staffLoading"
            style="width: 190px"
          >
            <el-option
              v-for="item in staffOptions"
              :key="item.staffCode"
              :label="item.staffName"
              :value="item.staffCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="客户状态">
          <el-select v-model="filters.statusCode" clearable placeholder="全部状态" style="width: 140px">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :loading="loading" @click="submitSearch">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="result-heading">
      <div>
        <div class="result-title-line">
          <h2>客户列表</h2>
          <span class="result-count"><strong>{{ pageData.total }}</strong> 条</span>
        </div>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          class="business-table supply-scroll-table"
          height="100%"
          v-loading="loading"
          :data="pageData.items"
          row-key="id"
          @row-click="openDetail"
        >
          <el-table-column type="index" label="序号" width="80" fixed="left" :index="tableRowIndex" />
          <el-table-column prop="customerCode" label="客户编号" width="150" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.customerCode || '-' }}</template>
          </el-table-column>
          <el-table-column prop="customerName" label="客户名称" min-width="240" show-overflow-tooltip>
            <template #default="scope">
              <span class="record-name">{{ scope.row.customerName || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="contactName" label="联系人" min-width="140" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.contactName || '-' }}</template>
          </el-table-column>
          <el-table-column prop="contactPhone" label="联系电话" min-width="150" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.contactPhone || '-' }}</template>
          </el-table-column>
          <el-table-column prop="customerTypeCode" label="客户类型" min-width="130" show-overflow-tooltip>
            <template #default="scope">{{ customerTypeLabel(scope.row.customerTypeCode) }}</template>
          </el-table-column>
          <el-table-column prop="regionCode" label="归属地区" min-width="130" show-overflow-tooltip>
            <template #default="scope">{{ customerAreaLabel(scope.row.regionCode) }}</template>
          </el-table-column>
          <el-table-column prop="ownerStaffNameSnapshot" label="归属销售人员" min-width="150" show-overflow-tooltip>
            <template #default="scope">
              {{ scope.row.ownerStaffNameSnapshot || scope.row.ownerSalesName || scope.row.ownerStaffCode || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="settlementTypeCode" label="结算类型" width="130">
            <template #default="scope">{{ settlementTypeLabel(scope.row.settlementTypeCode) }}</template>
          </el-table-column>
          <el-table-column label="客户状态" width="110">
            <template #default="scope">
              <el-tag :type="scope.row.statusCode === 'ACTIVE' ? 'success' : 'info'" effect="light">
                {{ statusLabel(scope.row.statusCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="170">
            <template #default="scope">{{ formatTime(scope.row.updatedTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="190" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
              <el-button link type="primary" @click.stop="openEdit(scope.row)">编辑</el-button>
              <el-button link type="danger" @click.stop="deleteCustomer(scope.row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无客户" /></template>
        </el-table>
      </div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="pageData.total"
          @current-change="loadCustomers"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" class="customer-detail-drawer" size="min(820px, 92vw)" :with-header="false">
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>客户详情</span>
            <h2>{{ detail.customerName }}</h2>
            <p>{{ detail.customerCode }} · {{ statusLabel(detail.statusCode) }}</p>
          </div>
          <el-button circle plain aria-label="关闭客户详情" @click="detailVisible = false">×</el-button>
        </header>
        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="客户编号">{{ detail.customerCode }}</el-descriptions-item>
            <el-descriptions-item label="客户名称">{{ detail.customerName }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ detail.contactName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ detail.contactPhone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户类型">{{ customerTypeLabel(detail.customerTypeCode) }}</el-descriptions-item>
            <el-descriptions-item label="归属地区">{{ customerAreaLabel(detail.regionCode) }}</el-descriptions-item>
            <el-descriptions-item label="归属销售人员">
              {{ detail.ownerStaffNameSnapshot || detail.ownerSalesName || detail.ownerStaffCode || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="结算类型">{{ settlementTypeLabel(detail.settlementTypeCode) }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ statusLabel(detail.statusCode) }}</el-descriptions-item>
            <el-descriptions-item label="客户地址" :span="2">{{ detail.address || '-' }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建人">{{ actorLabel(detail.createdBy) }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(detail.createdTime) }}</el-descriptions-item>
            <el-descriptions-item label="更新人">{{ actorLabel(detail.updatedBy) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(detail.updatedTime) }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      <el-skeleton v-else :rows="8" animated />
    </el-drawer>

    <el-dialog v-model="editorVisible" :title="editingId ? '编辑客户' : '新增客户'" width="min(760px, 92vw)" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="客户名称">
              <el-input v-model="form.customerName" clearable placeholder="请输入门店/商家名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户状态">
              <el-select v-model="form.statusCode" style="width: 100%">
                <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="form.contactName" clearable placeholder="客户联系人" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.contactPhone" clearable placeholder="手机号/固定电话" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户类型">
              <el-select v-model="form.customerTypeCode" clearable filterable placeholder="选择客户类型" style="width: 100%">
                <el-option v-for="item in customerTypeOptions" :key="item.code" :label="item.name" :value="item.code" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="归属地区">
              <el-select v-model="form.regionCode" clearable filterable placeholder="选择归属地区" style="width: 100%">
                <el-option v-for="item in customerAreaOptions" :key="item.code" :label="areaOptionLabel(item)" :value="item.code" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结算类型">
              <el-select v-model="form.settlementTypeCode" clearable placeholder="选择结算类型" style="width: 100%">
                <el-option
                  v-for="item in settlementTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="归属销售人员">
              <el-select
                v-model="form.ownerStaffCode"
                clearable
                filterable
                remote
                reserve-keyword
                placeholder="搜索姓名/员工编码"
                :remote-method="searchSalesStaff"
                :loading="staffLoading"
                style="width: 100%"
                @change="selectOwnerStaff"
                @clear="selectOwnerStaff('')"
              >
                <el-option
                  v-for="item in staffOptions"
                  :key="item.staffCode"
                  :label="item.staffName"
                  :value="item.staffCode"
                >
                  <div class="staff-option">
                    <strong>{{ item.staffName }}</strong>
                    <span>{{ item.staffCode }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="客户地址">
              <el-input v-model="form.address" clearable placeholder="客户经营/收货地址" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="1000" show-word-limit />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveCustomer">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '@/api'
import {
  createInternalCrmCustomer,
  deleteInternalCrmCustomer,
  getCrmCustomerAreas,
  getCrmCustomerTypes,
  getInternalCrmCustomer,
  getInternalCrmCustomers,
  updateInternalCrmCustomer,
  type CrmPage,
  type CrmDictionaryView,
  type InternalCrmCustomerCommand,
  type InternalCrmCustomerDetail,
  type InternalCrmCustomerSummary,
} from '@/api/core/crm'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'
import type { StaffRecord } from '@/types/management'

const route = useRoute()
const statusOptions = computed(() => businessDictionaryOptions('CRM', 'CUSTOMER_STATUS'))
const settlementTypeOptions = computed(() => businessDictionaryOptions('CRM', 'CUSTOMER_SETTLEMENT_TYPE'))

const loading = ref(false)
const saving = ref(false)
const staffLoading = ref(false)
const detailVisible = ref(false)
const editorVisible = ref(false)
const detail = ref<InternalCrmCustomerDetail | null>(null)
const editingId = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<CrmPage<InternalCrmCustomerSummary>>({ total: 0, begin: 0, step: 20, items: [] })
const staffOptions = ref<StaffRecord[]>([])
const customerTypeOptions = ref<CrmDictionaryView[]>([])
const customerAreaOptions = ref<CrmDictionaryView[]>([])

const filters = reactive({
  customerCode: '',
  customerName: '',
  contactPhone: '',
  customerTypeCode: '',
  regionCode: '',
  ownerStaffCode: '',
  statusCode: '',
})

const form = reactive({
  customerName: '',
  contactName: '',
  contactPhone: '',
  customerTypeCode: '',
  regionCode: '',
  ownerSalesUserId: '',
  ownerSalesName: '',
  ownerStaffCode: '',
  ownerStaffNameSnapshot: '',
  settlementTypeCode: '',
  address: '',
  statusCode: '',
  remark: '',
  revision: null as number | null,
})

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

onMounted(() => {
  applyRouteFilters()
  void loadBusinessDictionaries([
    { moduleCode: 'CRM', code: 'CUSTOMER_STATUS' },
    { moduleCode: 'CRM', code: 'CUSTOMER_SETTLEMENT_TYPE' },
  ])
  void Promise.all([loadCrmMasterOptions(), loadCustomers(), searchSalesStaff('')])
})

watch(() => route.query, () => {
  if (!applyRouteFilters()) return
  currentPage.value = 1
  void loadCustomers()
})

async function loadCustomers() {
  loading.value = true
  try {
    pageData.value = await getInternalCrmCustomers({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      customerCode: empty(filters.customerCode),
      customerName: empty(filters.customerName),
      contactPhone: empty(filters.contactPhone),
      customerTypeCode: empty(filters.customerTypeCode),
      regionCode: empty(filters.regionCode),
      ownerStaffCode: empty(filters.ownerStaffCode),
      statusCode: empty(filters.statusCode),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '客户列表加载失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.customerCode = ''
  filters.customerName = ''
  filters.contactPhone = ''
  filters.customerTypeCode = ''
  filters.regionCode = ''
  filters.ownerStaffCode = ''
  filters.statusCode = ''
  currentPage.value = 1
  void loadCustomers()
}

function submitSearch() {
  currentPage.value = 1
  void loadCustomers()
}

function applyRouteFilters() {
  const customerCode = queryText(route.query.customerCode)
  const customerName = queryText(route.query.customerName)
  const customerTypeCode = queryText(route.query.customerTypeCode)
  const regionCode = queryText(route.query.regionCode)
  const ownerStaffCode = queryText(route.query.ownerStaffCode)
  let changed = false
  if (customerCode && filters.customerCode !== customerCode) {
    filters.customerCode = customerCode
    changed = true
  }
  if (customerName && filters.customerName !== customerName) {
    filters.customerName = customerName
    changed = true
  }
  if (customerTypeCode && filters.customerTypeCode !== customerTypeCode) {
    filters.customerTypeCode = customerTypeCode
    changed = true
  }
  if (regionCode && filters.regionCode !== regionCode) {
    filters.regionCode = regionCode
    changed = true
  }
  if (ownerStaffCode && filters.ownerStaffCode !== ownerStaffCode) {
    filters.ownerStaffCode = ownerStaffCode
    ensureStaffOption(ownerStaffCode, ownerStaffCode)
    changed = true
  }
  return changed
}

function queryText(value: unknown) {
  if (Array.isArray(value)) return String(value[0] || '').trim()
  return typeof value === 'string' ? value.trim() : ''
}

function handleSizeChange() {
  currentPage.value = 1
  void loadCustomers()
}

async function openDetail(row: InternalCrmCustomerSummary) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getInternalCrmCustomer(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '客户详情加载失败'))
  }
}

function openCreate() {
  editingId.value = null
  resetForm()
  editorVisible.value = true
}

async function openEdit(row: InternalCrmCustomerSummary) {
  try {
    const current = await getInternalCrmCustomer(row.id)
    editingId.value = row.id
    form.customerName = current.customerName
    form.contactName = current.contactName || ''
    form.contactPhone = current.contactPhone || ''
    form.customerTypeCode = current.customerTypeCode || ''
    form.regionCode = current.regionCode || ''
    form.ownerSalesUserId = current.ownerSalesUserId || ''
    form.ownerSalesName = current.ownerSalesName || current.ownerStaffNameSnapshot || ''
    form.ownerStaffCode = current.ownerStaffCode || ''
    form.ownerStaffNameSnapshot = current.ownerStaffNameSnapshot || current.ownerSalesName || ''
    ensureStaffOption(form.ownerStaffCode, form.ownerStaffNameSnapshot)
    form.settlementTypeCode = current.settlementTypeCode || ''
    form.address = current.address || ''
    form.statusCode = current.statusCode || ''
    form.remark = current.remark || ''
    form.revision = current.revision
    editorVisible.value = true
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '客户信息加载失败'))
  }
}

async function saveCustomer() {
  const command = buildCommand()
  if (!command) return
  saving.value = true
  try {
    if (editingId.value) {
      await updateInternalCrmCustomer(editingId.value, command)
      ElMessage.success('客户已保存')
    } else {
      await createInternalCrmCustomer(command)
      ElMessage.success('客户已新增')
    }
    editorVisible.value = false
    await loadCustomers()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '客户保存失败'))
  } finally {
    saving.value = false
  }
}

async function deleteCustomer(row: InternalCrmCustomerSummary) {
  try {
    await ElMessageBox.confirm(`确认删除客户「${row.customerName}」？删除后不会物理清库，只会按后端规则做逻辑删除。`, '删除客户', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteInternalCrmCustomer(row.id, row.revision)
    ElMessage.success('客户已删除')
    await loadCustomers()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(errorMessage(reason, '客户删除失败'))
  }
}

function buildCommand(): InternalCrmCustomerCommand | null {
  if (!form.customerName.trim()) {
    ElMessage.warning('请输入客户名称')
    return null
  }
  return {
    customerName: form.customerName.trim(),
    contactName: empty(form.contactName),
    contactPhone: empty(form.contactPhone),
    customerTypeCode: empty(form.customerTypeCode),
    regionCode: empty(form.regionCode),
    ownerSalesUserId: empty(form.ownerSalesUserId),
    ownerSalesName: empty(form.ownerSalesName),
    ownerStaffCode: empty(form.ownerStaffCode),
    ownerStaffNameSnapshot: empty(form.ownerStaffNameSnapshot),
    settlementTypeCode: empty(form.settlementTypeCode),
    address: empty(form.address),
    statusCode: empty(form.statusCode),
    remark: empty(form.remark),
    revision: editingId.value ? form.revision : null,
  }
}

function resetForm() {
  form.customerName = ''
  form.contactName = ''
  form.contactPhone = ''
  form.customerTypeCode = ''
  form.regionCode = ''
  form.ownerSalesUserId = ''
  form.ownerSalesName = ''
  form.ownerStaffCode = ''
  form.ownerStaffNameSnapshot = ''
  form.settlementTypeCode = ''
  form.address = ''
  form.statusCode = ''
  form.remark = ''
  form.revision = null
}

function statusLabel(value: string | null | undefined) {
  return businessDictionaryLabel('CRM', 'CUSTOMER_STATUS', value, '客户状态')
}

function settlementTypeLabel(value: string | null | undefined) {
  return businessDictionaryLabel('CRM', 'CUSTOMER_SETTLEMENT_TYPE', value, '结算类型')
}

function customerTypeLabel(value: string | null | undefined) {
  if (!value) return '-'
  return customerTypeOptions.value.find((item) => item.code === value)?.name || value
}

function customerAreaLabel(value: string | null | undefined) {
  if (!value) return '-'
  return customerAreaOptions.value.find((item) => item.code === value)?.name || value
}

function areaOptionLabel(item: CrmDictionaryView) {
  return item.parentCode ? `${item.name} / ${item.parentCode}` : item.name
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

function actorLabel(value: string | null | undefined) {
  if (!value) return '-'
  return value === 'DHB_SYNC' ? '系统同步' : value
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}

async function searchSalesStaff(query: string) {
  staffLoading.value = true
  try {
    const params = new URLSearchParams()
    params.set('status', 'ACTIVE')
    if (query.trim()) params.set('keyword', query.trim())
    staffOptions.value = await apiClient.get(`/management/tenant/staff?${params.toString()}`) as StaffRecord[]
  } finally {
    staffLoading.value = false
  }
}

async function loadCrmMasterOptions() {
  try {
    const [types, areas] = await Promise.all([
      getCrmCustomerTypes({ step: 200 }),
      getCrmCustomerAreas({ step: 200 }),
    ])
    customerTypeOptions.value = types.items.filter((item) => item.status === 'ACTIVE')
    customerAreaOptions.value = areas.items.filter((item) => item.status === 'ACTIVE')
  } catch (reason) {
    ElMessage.warning(errorMessage(reason, '客户类型或地区加载失败，可稍后刷新'))
  }
}

function selectOwnerStaff(value: string | number) {
  const code = String(value || '')
  const selected = staffOptions.value.find((item) => item.staffCode === code)
  form.ownerStaffCode = code
  form.ownerStaffNameSnapshot = selected?.staffName || ''
  form.ownerSalesUserId = ''
  form.ownerSalesName = selected?.staffName || ''
}

function ensureStaffOption(staffCode: string, staffName: string) {
  if (!staffCode || staffOptions.value.some((item) => item.staffCode === staffCode)) return
  staffOptions.value = [{
    id: staffCode,
    staffCode,
    staffName: staffName || staffCode,
    mobile: null,
    email: null,
    employmentStatus: 'ACTIVE',
    primaryOrganizationId: null,
    primaryOrganizationName: null,
    primaryPositionId: null,
    primaryPositionName: null,
    userId: null,
    username: null,
    userDisplayName: null,
    recordOrigin: 'MANUAL',
    remark: null,
    sourceSystem: null,
    sourceStaffId: null,
    sourceStaffType: null,
    sourceAccountName: null,
    sourceTitle: null,
    sourceBranchName: null,
    sourceRole: null,
    sourceStatus: null,
    sourcePresence: null,
    lastSeenAt: null,
    version: 0,
  }, ...staffOptions.value]
}
</script>

<style scoped lang="scss">
.customer-management-page {
  min-height: 0;
}

.staff-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span {
    color: #94a3b8;
    font-size: 12px;
  }
}
</style>
