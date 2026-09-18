<template>
  <div class="order-register-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">订单管理 · 订单列表</span>
        <SupplyPageTitle>订单列表</SupplyPageTitle>
        <p>查看订货宝与飞书订单、冻结归属、金额汇总和来源审计。</p>
      </div>
      <div class="heading-actions">
        <OrderPackageSyncButton @completed="loadOrders" />
      </div>
    </div>

    <OrderRegisterFilterCard :loading="loading" @search="search" @reset="resetFilters">
      <template #actions>
        <el-button :loading="exporting" @click="exportCsv">导出</el-button>
      </template>
      <template #primary>
        <el-input v-model="filters.orderNo" aria-label="订单号" clearable placeholder="订单号" style="width: 170px" @keyup.enter="search" />
        <el-input v-model="filters.customerName" aria-label="客户名称" clearable placeholder="客户名称" style="width: 180px" @keyup.enter="search" />
        <el-input v-model="filters.customerCode" aria-label="客户编码" clearable placeholder="客户编码" style="width: 150px" @keyup.enter="search" />
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
        <el-select v-model="pageFilters.orderStatusCode" aria-label="订单状态" clearable placeholder="订单状态" style="width: 140px">
          <el-option v-for="item in orderStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="pageFilters.paymentStatusCode" aria-label="收款状态" clearable placeholder="收款状态" style="width: 140px">
          <el-option v-for="item in paymentStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </template>
      <template #extra>
        <el-select v-model="pageFilters.hasUnpaid" aria-label="是否存在未回款" clearable placeholder="是否存在未回款" style="width: 160px">
          <el-option label="有未回款" value="true" />
          <el-option label="无未回款" value="false" />
        </el-select>
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
      </template>
    </OrderRegisterFilterCard>

    <el-alert
      v-if="coverageNotice"
      :title="coverageNotice"
      type="warning"
      :closable="false"
      class="order-register-coverage"
    />

    <div class="result-heading">
      <div class="result-title-line">
        <h2>订单列表</h2>
        <span class="result-count"><strong>{{ pageData.total }}</strong> 条</span>
      </div>
      <div class="result-totals">
        <span>订单金额 <strong>{{ moneyText(totals.payableAmount) }}</strong></span>
        <span>回款金额 <strong>{{ moneyText(totals.paidAmount) }}</strong></span>
        <span>待收金额 <strong>{{ moneyText(totals.unpaidAmount) }}</strong></span>
        <span>已核金额 <strong>{{ moneyText(totals.checkedAmount) }}</strong></span>
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
          :default-sort="{ prop: 'createdTime', order: 'descending' }"
          @sort-change="changeSort"
        >
          <template #empty>
            <div v-if="loadFailed" class="order-load-failed">
              <span>订单列表加载失败，当前没有可展示的数据。</span>
              <el-button link type="primary" @click="loadOrders">重新加载</el-button>
            </div>
            <span v-else>暂无数据</span>
          </template>
          <el-table-column type="index" label="序号" width="70" fixed="left" :index="tableRowIndex" />
          <el-table-column label="订单号" width="170" fixed="left" sortable="custom" prop="orderNo">
            <template #default="{ row }">
              <el-link type="primary" underline="never" @click.stop="openDetail(row)">
                <span class="order-no-cell">{{ row.orderNo || '-' }}</span>
              </el-link>
            </template>
          </el-table-column>
          <el-table-column prop="customerName" label="客户名称" min-width="190" show-overflow-tooltip>
            <template #default="{ row }">{{ row.customerName || '-' }}</template>
          </el-table-column>
          <el-table-column label="归属地区" width="140">
            <template #default="{ row }">{{ areaLabel(row.regionCode, row.regionName) }}</template>
          </el-table-column>
          <el-table-column label="所属业务员" width="120">
            <template #default="{ row }">{{ employeeLabel(row.ownerEmployeeCode, row.ownerEmployeeName) }}</template>
          </el-table-column>
          <el-table-column label="部门" width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ departmentLabel(row.departmentId, row.departmentName) }}</template>
          </el-table-column>
          <el-table-column label="订单状态" width="110">
            <template #default="{ row }">
              <el-tag :type="orderStatusTag(row.orderStatusCode)" effect="plain" size="small">
                {{ orderStatusLabel(row.orderStatusCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="收款状态" width="110">
            <template #default="{ row }">
              <el-tag :type="orderPaymentStatusTag(row.paymentStatusCode)" effect="plain" size="small">
                {{ orderPaymentStatusLabel(row.paymentStatusCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="订货金额" width="120" align="right" prop="originalAmount">
            <template #default="{ row }">{{ moneyText(row.originalAmount) }}</template>
          </el-table-column>
          <el-table-column label="订单金额" width="120" align="right" prop="payableAmount">
            <template #default="{ row }">{{ moneyText(row.payableAmount) }}</template>
          </el-table-column>
          <el-table-column label="回款金额" width="120" align="right" prop="paidAmount">
            <template #default="{ row }">{{ moneyText(row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column label="待收金额" width="120" align="right" prop="unpaidAmount">
            <template #default="{ row }">{{ moneyText(row.unpaidAmount) }}</template>
          </el-table-column>
          <el-table-column label="已核金额" width="120" align="right" prop="checkedAmount">
            <template #default="{ row }">{{ moneyText(row.checkedAmount) }}</template>
          </el-table-column>
          <el-table-column label="下单时间" width="170" sortable="custom" prop="orderDate">
            <template #default="{ row }">{{ displayDateTime(row.orderDate) }}</template>
          </el-table-column>
          <el-table-column label="发货时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.shipmentTime) }}</template>
          </el-table-column>
          <el-table-column label="来源单号" width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.sourceOrderNo || '-' }}</template>
          </el-table-column>
          <el-table-column label="创建人" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.createdBy || '-' }}</template>
          </el-table-column>
          <el-table-column label="创建时间" width="170" sortable="custom" prop="createdTime">
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
          <el-table-column label="同步时间" width="170" sortable="custom" prop="syncedAt">
            <template #default="{ row }">{{ displayDateTime(row.syncedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openLines(row)">明细</el-button>
              <el-button link type="primary" size="small" @click="openPayments(row)">回款</el-button>
            </template>
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
          @current-change="loadOrders"
        />
      </div>
    </el-card>

    <OrderRegisterDetailDrawer v-model="detailVisible" :order-id="detailOrderId" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import OrderPackageSyncButton from '@/components/supply/OrderPackageSyncButton.vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import OrderRegisterDetailDrawer from './components/OrderRegisterDetailDrawer.vue'
import { displayDateTime } from '@/utils/business-date'
import {
  moneyText,
  orderPaymentStatusLabel,
  orderPaymentStatusTag,
  orderStatusLabel,
  orderStatusTag,
} from '@/utils/order-register-status'
import { empty, hasUnpaidValue, orderRegisterDateParams } from '@/utils/order-register-query'
import { csvFilename, downloadBlob } from '@/utils/file-download'
import {
  exportOrderRegisterCsv,
  getOrderRegisterOrders,
  type OrderRegisterOrderPage,
  type OrderRegisterCoverage,
} from '@/api/core/order-register'
import { useOrderRegisterCommonFilters } from '@/composables/useOrderRegisterQuery'
import { useOrderRegisterOptions } from '@/composables/useOrderRegisterOptions'

const router = useRouter()
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
  orderStatusCode: '',
  paymentStatusCode: '',
  hasUnpaid: '',
})

const orderStatusOptions = [
  { value: 'PENDING_OUTBOUND', label: '待出库' },
  { value: 'PENDING_SHIPPED', label: '待发货' },
  { value: 'RECEIVED', label: '已收货' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
  { value: 'RETURNED', label: '已退货' },
  { value: 'SUBMITTED', label: '已提交（飞书历史）' },
]
const paymentStatusOptions = [
  { value: 'UNPAID', label: '待收款' },
  { value: 'PARTIAL_PAID', label: '部分收款' },
  { value: 'PAID', label: '已收款' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'REFUNDED', label: '已退款' },
  { value: 'CANCELLED', label: '已取消' },
]

const loading = ref(false)
const loadFailed = ref(false)
const exporting = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const sortBy = ref<'createdTime' | 'orderDate' | 'syncedAt' | 'orderNo'>('createdTime')
const sortDirection = ref<'asc' | 'desc'>('desc')
const pageData = ref<OrderRegisterOrderPage>({
  total: 0,
  begin: 0,
  step: 20,
  items: [],
  totals: {
    originalAmount: 0,
    payableAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    checkedAmount: 0,
  },
  coverage: null,
})
const totals = computed(() => pageData.value.totals)
const coverageNotice = computed(() => coverageText(pageData.value.coverage))

const detailVisible = ref(false)
const detailOrderId = ref<string | number | null>(null)

function coverageText(coverage: OrderRegisterCoverage | null): string {
  if (!coverage) return ''
  if (coverage.message) return coverage.message
  if (coverage.historyComplete === false) {
    return coverage.coverageFrom
      ? `历史数据仅可从 ${coverage.coverageFrom} 起准确回溯，此前范围不完整。`
      : '历史数据覆盖不完整，未回款等历史口径不能视为已确认。'
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
  const dateParams = orderRegisterDateParams(filters.orderDateRange)
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
    orderStatusCode: empty(pageFilters.orderStatusCode),
    paymentStatusCode: empty(pageFilters.paymentStatusCode),
    hasUnpaid: hasUnpaidValue(pageFilters.hasUnpaid),
    sortBy: sortBy.value,
    sortDirection: sortDirection.value,
    ...dateParams,
  }
}

async function loadOrders() {
  loading.value = true
  loadFailed.value = false
  try {
    pageData.value = await getOrderRegisterOrders(buildQuery())
  } catch (reason) {
    loadFailed.value = true
    ElMessage.error(errorMessage(reason, '订单列表加载失败，请稍后重试'))
  } finally {
    loading.value = false
  }
}

function search() {
  currentPage.value = 1
  void loadOrders()
}

function resetFilters() {
  resetCommonFilters()
  pageFilters.orderStatusCode = ''
  pageFilters.paymentStatusCode = ''
  pageFilters.hasUnpaid = ''
  sortBy.value = 'createdTime'
  sortDirection.value = 'desc'
  search()
}

function onPageSizeChange() {
  currentPage.value = 1
  void loadOrders()
}

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

function changeSort({ prop, order }: { prop: string | null; order: string | null }) {
  const allowed = new Set(['createdTime', 'orderDate', 'syncedAt', 'orderNo'])
  if (prop && allowed.has(prop)) {
    sortBy.value = prop as typeof sortBy.value
    sortDirection.value = order === 'ascending' ? 'asc' : 'desc'
  } else {
    sortBy.value = 'createdTime'
    sortDirection.value = 'desc'
  }
  search()
}

function openDetail(row: { id?: string | number }) {
  detailOrderId.value = row.id ?? null
  detailVisible.value = true
}

function openLines(row: { orderNo?: string }) {
  if (row.orderNo) {
    void router.push({ path: '/supply-chain/order/lines', query: { orderNo: row.orderNo } })
  }
}

function openPayments(row: { orderNo?: string }) {
  if (row.orderNo) {
    void router.push({ path: '/supply-chain/order/sales-payments', query: { orderNo: row.orderNo } })
  }
}

async function exportCsv() {
  exporting.value = true
  try {
    const query = buildQuery()
    const params: Record<string, unknown> = { ...query }
    delete params.begin
    delete params.step
    const blob = await exportOrderRegisterCsv('orders', params)
    downloadBlob(blob, csvFilename('订单列表'))
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '导出失败，请稍后重试'))
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  void loadOptions()
  void loadOrders()
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
.order-load-failed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-color-danger);
}
.order-no-cell {
  font-weight: 600;
}
</style>
