<template>
  <div class="order-register-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">订单管理 · 收款列表</span>
        <SupplyPageTitle>收款列表</SupplyPageTitle>
        <p>一行一笔关联订单的收款；待收款和已取消不计入实际回款。</p>
      </div>
    </div>

    <OrderRegisterFilterCard :loading="loading" @search="search" @reset="resetFilters">
      <template #actions>
        <el-button :loading="exporting" @click="exportCsv">导出</el-button>
      </template>
      <template #primary>
        <el-input v-model="filters.orderNo" aria-label="订单号" clearable placeholder="订单号" style="width: 160px" @keyup.enter="search" />
        <el-input v-model="pageFilters.paymentNo" aria-label="收款编码" clearable placeholder="收款编码" style="width: 160px" @keyup.enter="search" />
        <el-input v-model="pageFilters.transactionNo" aria-label="交易流水号" clearable placeholder="交易流水号" style="width: 170px" @keyup.enter="search" />
        <el-input v-model="filters.customerName" aria-label="客户名称" clearable placeholder="客户名称" style="width: 170px" @keyup.enter="search" />
        <el-select v-model="pageFilters.paymentStatusCode" aria-label="收款状态" clearable placeholder="收款状态" style="width: 130px">
          <el-option v-for="item in paymentStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-tree-select
          v-model="filters.regionCode"
          :data="areaTree"
          :props="areaTreeProps"
          node-key="code"
          check-strictly
          :render-after-expand="false"
          :default-expanded-keys="areaTree.map((row) => row.code)"
          aria-label="归属地区"
          clearable
          filterable
          placeholder="归属地区"
          style="width: 160px"
        />
        <el-select
          v-model="filters.ownerEmployeeCode"
          aria-label="所属业务员"
          clearable
          filterable
          remote
          reserve-keyword
          placeholder="所属业务员"
          :remote-method="searchEmployees"
          :loading="employeeLoading"
          style="width: 170px"
        >
          <el-option
            v-for="item in employeeOptions"
            :key="item.employeeCode"
            :label="item.employeeName"
            :value="item.employeeCode"
          />
        </el-select>
      </template>
      <template #extra>
        <el-tree-select
          v-model="filters.departmentId"
          :data="departmentOptionsTree"
          :props="departmentTreeProps"
          node-key="id"
          check-strictly
          :render-after-expand="false"
          :default-expanded-keys="departmentOptionsTree.map((row) => row.id)"
          aria-label="部门"
          clearable
          filterable
          placeholder="部门"
          style="width: 160px"
        />
        <el-input v-model="filters.customerCode" aria-label="客户编码" clearable placeholder="客户编码" style="width: 150px" @keyup.enter="search" />
        <el-select v-model="filters.createdBy" aria-label="创建人" clearable filterable placeholder="创建人" style="width: 150px">
          <el-option v-for="name in creatorOptions" :key="name" :label="name" :value="name" />
        </el-select>
        <el-date-picker
          v-model="filters.orderDateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="下单开始日期"
          end-placeholder="下单截止日期"
          aria-label="下单时间"
          style="width: 250px"
        />
        <el-date-picker
          v-model="pageFilters.paymentTimeRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="收款开始日期"
          end-placeholder="收款截止日期"
          aria-label="收款时间"
          style="width: 250px"
        />
      </template>
    </OrderRegisterFilterCard>

    <el-alert
      v-if="coverageNotice"
      :title="coverageNotice"
      type="warning"
      :closable="false"
      class="order-register-coverage"
    />
    <el-alert
      v-if="filters.orderDateRange && pageFilters.paymentTimeRange"
      title="下单时间与收款时间两项条件同时生效，结果取交集。"
      type="info"
      :closable="false"
      class="order-register-coverage"
    />

    <div class="result-heading">
      <div class="result-title-line">
        <h2>收款列表</h2>
        <span class="result-count"><strong>{{ pageData.total }}</strong> 条</span>
      </div>
      <div class="result-totals">
        <span>实收金额 <strong>{{ moneyText(pageData.totals.receivedAmount) }}</strong></span>
        <span>已核金额 <strong>{{ moneyText(pageData.totals.checkedAmount) }}</strong></span>
        <span>待收款单据 <strong>{{ moneyText(pageData.totals.pendingDocumentAmount) }}</strong></span>
        <span>已取消单据 <strong>{{ moneyText(pageData.totals.cancelledDocumentAmount) }}</strong></span>
        <span>关联订单金额（按订单去重） <strong>{{ moneyText(pageData.totals.relatedOrderAmount) }}</strong></span>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          class="business-table supply-scroll-table order-register-table"
          height="100%"
          v-loading="loading"
          :data="pageData.items"
          row-key="id"
          :default-sort="{ prop: 'paymentTime', order: 'descending' }"
          @sort-change="changeSort"
        >
          <el-table-column type="index" label="序号" width="70" fixed="left" :index="tableRowIndex" />
          <el-table-column label="订单号" width="160" fixed="left">
            <template #default="{ row }">
              <el-link type="primary" underline="never" @click.stop="openDetail(row)">
                <span class="order-no-cell">{{ row.orderNo || '-' }}</span>
              </el-link>
            </template>
          </el-table-column>
          <el-table-column label="付款凭证" width="130">
            <template #default="{ row }">
              <FundAttachmentPreviewList :attachments="row.attachments || []" direction="row" />
            </template>
          </el-table-column>
          <el-table-column prop="transactionNo" label="交易流水号" width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.transactionNo || '-' }}</template>
          </el-table-column>
          <el-table-column prop="paymentNo" label="收款编码" width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.paymentNo || '-' }}</template>
          </el-table-column>
          <el-table-column prop="customerName" label="客户名称" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.customerName || '-' }}</template>
          </el-table-column>
          <el-table-column label="归属地区" width="130">
            <template #default="{ row }">{{ areaLabel(row.regionCode, row.regionName) }}</template>
          </el-table-column>
          <el-table-column label="所属业务员" width="120">
            <template #default="{ row }">{{ employeeLabel(row.ownerEmployeeCode, row.ownerEmployeeName) }}</template>
          </el-table-column>
          <el-table-column label="部门" width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ departmentLabel(row.departmentId, row.departmentName) }}</template>
          </el-table-column>
          <el-table-column label="订单金额" width="120" align="right" prop="orderAmount">
            <template #default="{ row }">{{ moneyText(row.orderAmount) }}</template>
          </el-table-column>
          <el-table-column label="收款金额" width="120" align="right" prop="paidAmount">
            <template #default="{ row }"><strong>{{ moneyText(row.paidAmount) }}</strong></template>
          </el-table-column>
          <el-table-column label="收款状态" width="110">
            <template #default="{ row }">
              <el-tag :type="paymentRecordStatusTag(row.paymentStatusCode)" effect="plain" size="small">
                {{ paymentRecordStatusLabel(row.paymentStatusCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="收款时间" width="170" sortable="custom" prop="paymentTime">
            <template #default="{ row }">{{ displayDateTime(row.paymentTime) }}</template>
          </el-table-column>
          <el-table-column label="核对人" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.checkedBy || '-' }}</template>
          </el-table-column>
          <el-table-column label="核对时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.checkedAt) }}</template>
          </el-table-column>
          <el-table-column label="创建人" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.createdBy || '-' }}</template>
          </el-table-column>
          <el-table-column label="创建时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.createdTime) }}</template>
          </el-table-column>
          <el-table-column label="修改人" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.updatedBy || '-' }}</template>
          </el-table-column>
          <el-table-column label="修改时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.updatedTime) }}</template>
          </el-table-column>
          <el-table-column label="同步人" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.syncedBy || '-' }}</template>
          </el-table-column>
          <el-table-column label="同步时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.syncedAt) }}</template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="pageData.total"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="onPageSizeChange"
          @current-change="loadPayments"
        />
      </div>
    </el-card>

    <OrderRegisterDetailDrawer v-model="detailVisible" :order-id="detailOrderId" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import OrderRegisterDetailDrawer from './components/OrderRegisterDetailDrawer.vue'
import FundAttachmentPreviewList from '@/components/supply/FundAttachmentPreviewList.vue'
import { displayDateTime } from '@/utils/business-date'
import {
  moneyText,
  paymentRecordStatusLabel,
  paymentRecordStatusTag,
} from '@/utils/order-register-status'
import { dateRangeParams, empty, orderRegisterDateParams } from '@/utils/order-register-query'
import { csvFilename, downloadBlob } from '@/utils/file-download'
import {
  exportOrderRegisterCsv,
  getOrderRegisterPayments,
  type OrderRegisterCoverage,
  type OrderRegisterPaymentPage,
} from '@/api/core/order-register'
import { useOrderRegisterCommonFilters } from '@/composables/useOrderRegisterQuery'
import { useOrderRegisterOptions } from '@/composables/useOrderRegisterOptions'

const route = useRoute()
const {
  areaTree,
  departmentOptionsTree,
  employeeOptions,
  employeeLoading,
  creatorOptions,
  areaTreeProps,
  departmentTreeProps,
  loadOptions,
  searchEmployees,
  areaLabel,
  departmentLabel,
  employeeLabel,
} = useOrderRegisterOptions()
const { filters, resetCommonFilters } = useOrderRegisterCommonFilters()
const pageFilters = reactive({
  paymentNo: '',
  transactionNo: '',
  paymentStatusCode: '',
  paymentTimeRange: null as [string, string] | null,
})

const paymentStatusOptions = [
  { value: 'PENDING', label: '待收款' },
  { value: 'CONFIRMED', label: '已收款' },
  { value: 'CHECKED', label: '已核对' },
  { value: 'CANCELLED', label: '已取消' },
]

const loading = ref(false)
const exporting = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const sortBy = ref<'paymentTime' | 'createdTime' | 'syncedAt'>('paymentTime')
const sortDirection = ref<'asc' | 'desc'>('desc')
const pageData = ref<OrderRegisterPaymentPage>({
  total: 0,
  begin: 0,
  step: 20,
  items: [],
  totals: {
    receivedAmount: 0,
    checkedAmount: 0,
    pendingDocumentAmount: 0,
    cancelledDocumentAmount: 0,
    relatedOrderAmount: 0,
  },
  coverage: null,
})
const coverageNotice = computed(() => coverageText(pageData.value.coverage))

const detailVisible = ref(false)
const detailOrderId = ref<string | number | null>(null)

function coverageText(coverage: OrderRegisterCoverage | null): string {
  if (!coverage) return ''
  if (coverage.message) return coverage.message
  if (coverage.historyComplete === false) {
    return coverage.coverageFrom
      ? `历史回款仅可从 ${coverage.coverageFrom} 起准确回溯，此前范围不完整。`
      : '历史回款覆盖不完整，实收与待收不能视为已确认。'
  }
  return ''
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}

function buildQuery() {
  const orderDate = orderRegisterDateParams(filters.orderDateRange)
  const paymentDate = dateRangeParams(
    pageFilters.paymentTimeRange,
    'paymentTimeFrom',
    'paymentTimeTo',
  )
  return {
    begin: (currentPage.value - 1) * pageSize.value,
    step: pageSize.value,
    orderNo: empty(filters.orderNo),
    customerName: empty(filters.customerName),
    customerCode: empty(filters.customerCode),
    regionCode: empty(filters.regionCode),
    ownerEmployeeCode: empty(filters.ownerEmployeeCode),
    departmentId: filters.departmentId ?? undefined,
    createdBy: empty(filters.createdBy),
    paymentNo: empty(pageFilters.paymentNo),
    transactionNo: empty(pageFilters.transactionNo),
    paymentStatusCode: empty(pageFilters.paymentStatusCode),
    sortBy: sortBy.value,
    sortDirection: sortDirection.value,
    ...orderDate,
    ...paymentDate,
  }
}

async function loadPayments() {
  loading.value = true
  try {
    pageData.value = await getOrderRegisterPayments(buildQuery())
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '收款列表加载失败，请稍后重试'))
  } finally {
    loading.value = false
  }
}

function search() {
  currentPage.value = 1
  void loadPayments()
}

function resetFilters() {
  resetCommonFilters()
  pageFilters.paymentNo = ''
  pageFilters.transactionNo = ''
  pageFilters.paymentStatusCode = ''
  pageFilters.paymentTimeRange = null
  sortBy.value = 'paymentTime'
  sortDirection.value = 'desc'
  search()
}

function onPageSizeChange() {
  currentPage.value = 1
  void loadPayments()
}

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

function changeSort({ prop, order }: { prop: string | null; order: string | null }) {
  const allowed = new Set(['paymentTime', 'createdTime', 'syncedAt'])
  if (prop && allowed.has(prop)) {
    sortBy.value = prop as typeof sortBy.value
    sortDirection.value = order === 'ascending' ? 'asc' : 'desc'
  } else {
    sortBy.value = 'paymentTime'
    sortDirection.value = 'desc'
  }
  search()
}

function openDetail(row: { orderId?: string }) {
  detailOrderId.value = row.orderId ?? null
  detailVisible.value = true
}

async function exportCsv() {
  exporting.value = true
  try {
    const query = buildQuery()
    const params: Record<string, unknown> = { ...query }
    delete params.begin
    delete params.step
    const blob = await exportOrderRegisterCsv('payments', params)
    downloadBlob(blob, csvFilename('收款列表'))
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '导出失败，请稍后重试'))
  } finally {
    exporting.value = false
  }
}

watch(
  () => route.query.orderNo,
  (value) => {
    if (typeof value === 'string' && value.trim()) {
      filters.orderNo = value.trim()
      search()
    }
  },
  { immediate: true },
)

onMounted(() => {
  void loadOptions()
  if (!route.query.orderNo) void loadPayments()
})
</script>

<style scoped>
.order-register-page {
  min-height: 0;
}
.order-register-coverage {
  margin-bottom: 12px;
}
.result-totals {
  display: flex;
  gap: 18px;
  color: var(--el-text-color-regular);
  flex-wrap: wrap;
}
.result-totals strong {
  color: var(--el-text-color-primary);
}
.order-no-cell {
  font-weight: 600;
}
</style>
