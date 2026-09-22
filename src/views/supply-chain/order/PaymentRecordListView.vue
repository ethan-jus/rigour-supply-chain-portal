<template>
  <div class="order-register-page supply-page supply-page--business-main">
    <OrderRegisterFilterCard :loading="loading" query-first @search="search" @reset="resetFilters">
      <template #actions>
        <el-button plain :loading="exporting" @click="exportCsv">导出</el-button>
        <TableColumnSettings
          plain
          :columns="paymentColumns.columns"
          :visibility="paymentColumns.visibility"
          @change="paymentColumns.setVisible"
          @reset="paymentColumns.reset"
        />
      </template>
      <template #primary>
        <el-date-picker
          v-model="pageFilters.paymentTimeRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="付款开始日期"
          end-placeholder="付款截止日期"
          aria-label="付款时间"
          style="width: 250px"
        />
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
        <el-input v-model="filters.orderNo" aria-label="订单号" clearable placeholder="订单号" style="width: 160px" @keyup.enter="search" />
        <el-tree-select
          v-model="filters.departmentId"
          v-clear-filter-on-empty-input="() => (filters.departmentId = null)"
          :data="departmentOptionsTree"
          :props="departmentTreeProps"
          node-key="id"
          check-strictly
          :render-after-expand="false"
          :default-expanded-keys="departmentOptionsTree.map((row) => row.id)"
          aria-label="部门"
          clearable
          filterable
          placeholder="选择部门"
          popper-class="order-register-tree-popper"
          style="width: 160px"
        />
        <el-checkbox v-model="filters.includeSubDepartments">含子部门</el-checkbox>
        <el-input v-model="filters.customerName" aria-label="客户名称" clearable placeholder="客户名称" style="width: 170px" @keyup.enter="search" />
        <el-select v-model="pageFilters.paymentStatusCode" aria-label="收款状态" clearable placeholder="收款状态" style="width: 130px">
          <el-option v-for="item in paymentStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-tree-select
          v-model="filters.regionCode"
          v-clear-filter-on-empty-input="() => (filters.regionCode = '')"
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
          popper-class="order-register-tree-popper"
          style="width: 160px"
        />
        <el-select
          v-model="filters.ownerEmployeeCode"
          v-clear-filter-on-empty-input="() => (filters.ownerEmployeeCode = '')"
          aria-label="业务员"
          clearable
          filterable
          remote
          reserve-keyword
          placeholder="搜索业务员"
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
        <el-input v-model="pageFilters.transactionNo" aria-label="交易单号" clearable placeholder="交易单号" style="width: 170px" @keyup.enter="search" />
        <el-select
          v-model="filters.createdBy"
          v-clear-filter-on-empty-input="() => (filters.createdBy = '')"
          aria-label="创建人"
          clearable
          filterable
          placeholder="创建人"
          style="width: 150px"
        >
          <el-option v-for="name in creatorOptions" :key="name" :label="name" :value="name" />
        </el-select>
        <el-input v-model="pageFilters.paymentNo" aria-label="收款编码" clearable placeholder="收款编码" style="width: 160px" @keyup.enter="search" />
      </template>
    </OrderRegisterFilterCard>

    <div class="order-summary" aria-label="金额统计">
      <div class="order-summary__metric" title="当前查询条件下订单表的订单金额合计（订单侧条件，不受付款条件影响）">
        <span class="order-summary__label">应收金额</span>
        <strong class="order-summary__value">{{ moneyText(pageData.totals.relatedOrderAmount) }}</strong>
      </div>
      <div class="order-summary__metric" title="当前查询条件下已回款金额（不含待收款与已取消）">
        <span class="order-summary__label">实收金额</span>
        <strong class="order-summary__value">{{ moneyText(pageData.totals.receivedAmount) }}</strong>
      </div>
      <div class="order-summary__metric" title="应收金额 - 实收金额">
        <span class="order-summary__label">待收金额</span>
        <strong class="order-summary__value">{{ moneyText(receivablePending) }}</strong>
      </div>
      <div class="order-summary__metric" title="财务核对通过（已核对）的收款单额度合计">
        <span class="order-summary__label">核对金额</span>
        <strong class="order-summary__value">{{ moneyText(pageData.totals.checkedAmount) }}</strong>
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
          <!-- @vue-generic {OrderRegisterPaymentItem} -->
          <el-table-column type="index" label="序号" width="70" fixed="left" :index="tableRowIndex" />
          <el-table-column prop="paymentNo" label="收款编码" width="160" fixed="left" show-overflow-tooltip>
            <template #default="{ row }">
              <el-link type="primary" underline="never" @click.stop="openPaymentDetail(row as OrderRegisterPaymentItem)">
                <span class="order-no-cell">{{ row.paymentNo || '-' }}</span>
              </el-link>
            </template>
          </el-table-column>
          <el-table-column label="订单号" width="160" fixed="left">
            <template #default="{ row }">
              <el-link type="primary" underline="never" @click.stop="openDetail(row)">
                <span class="order-no-cell">{{ row.orderNo || '-' }}</span>
              </el-link>
            </template>
          </el-table-column>
          <el-table-column
            v-if="paymentColumns.isVisible('customerName')"
            prop="customerName"
            label="客户名称"
            min-width="240"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.customerName || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('regionName')" label="归属地区" width="140">
            <template #default="{ row }">{{ areaLabel(row.regionCode, row.regionName) }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('ownerEmployee')" label="业务员" width="110">
            <template #default="{ row }">{{ employeeLabel(row.ownerEmployeeCode, row.ownerEmployeeName) }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('departmentName')" label="部门" width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ departmentLabel(row.departmentId, row.departmentName) }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('orderAmount')" label="订单金额" width="120" align="right" prop="orderAmount">
            <template #default="{ row }">{{ moneyText(row.orderAmount) }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('paidAmount')" label="收款金额" width="120" align="right" prop="paidAmount">
            <template #default="{ row }">{{ moneyText(row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('paymentTime')" label="收款时间" width="170" sortable="custom" prop="paymentTime">
            <template #default="{ row }">{{ displayDateTime(row.paymentTime) }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('paymentStatus')" label="收款状态" width="100">
            <template #default="{ row }">
              <span class="status-cell">
                <i
                  class="status-dot"
                  :class="`status-dot--${paymentRecordStatusTag(row.paymentStatusCode)}`"
                />
                {{ paymentRecordStatusLabel(row.paymentStatusCode) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('checkedStatus')" label="核对状态" width="100">
            <template #default="{ row }">
              <span class="status-cell">
                <i
                  class="status-dot"
                  :class="`status-dot--${row.checkedAt || row.checkedBy ? 'success' : 'warning'}`"
                />
                {{ row.checkedAt || row.checkedBy ? '已核对' : '未核对' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('checkedBy')" label="核对人" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.checkedAt || row.checkedBy ? auditActorLabel(row.checkedBy) : '-' }}</template>
          </el-table-column>
          <el-table-column
            v-if="paymentColumns.isVisible('transactionNo')"
            prop="transactionNo"
            label="交易单号"
            width="280"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.transactionNo || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('attachments')" label="付款凭证" width="130">
            <template #default="{ row }">
              <FundAttachmentThumbnails
                :attachments="row.attachmentViews?.length ? row.attachmentViews : row.attachments"
              />
            </template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('createdBy')" label="创建人" width="110" show-overflow-tooltip>
            <template #header>
              <el-tooltip content="来源系统真实创建人；无来源时为本系统记录人。" placement="top">
                <span class="column-header-hint">创建人</span>
              </el-tooltip>
            </template>
            <template #default="{ row }">{{ auditActorLabel(row.createdBy) }}</template>
          </el-table-column>
          <el-table-column
            v-if="paymentColumns.isVisible('createdTime')"
            label="创建时间"
            width="170"
            sortable="custom"
            prop="createdTime"
          >
            <template #default="{ row }">{{ displayDateTime(row.createdTime) }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('updatedBy')" label="修改人" width="110" show-overflow-tooltip>
            <template #header>
              <el-tooltip content="来源系统真实修改人；无来源时为本系统记录人。" placement="top">
                <span class="column-header-hint">修改人</span>
              </el-tooltip>
            </template>
            <template #default="{ row }">{{ auditActorLabel(row.updatedBy) }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('updatedTime')" label="修改时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.updatedTime) }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('syncedBy')" label="同步人" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ auditActorLabel(row.syncedBy) }}</template>
          </el-table-column>
          <el-table-column
            v-if="paymentColumns.isVisible('syncedAt')"
            label="同步时间"
            width="170"
            sortable="custom"
            prop="syncedAt"
          >
            <template #default="{ row }">{{ displayDateTime(row.syncedAt) }}</template>
          </el-table-column>
          <el-table-column
            v-if="paymentColumns.isVisible('sourceRecordId')"
            prop="sourceRecordId"
            label="来源回款号"
            width="170"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.sourceRecordId || '-' }}</template>
          </el-table-column>
          <el-table-column
            v-if="paymentColumns.isVisible('dhbOrderNo')"
            prop="dhbOrderNo"
            label="订货宝订单号"
            width="160"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.dhbOrderNo || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="paymentColumns.isVisible('checkedAt')" label="核对时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.checkedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="110" fixed="right" class-name="order-actions-cell">
            <template #default="{ row }">
              <el-button
                v-if="
                  canCheckPayments &&
                  row.paymentStatusCode !== 'CHECKED' &&
                  row.paymentStatusCode !== 'CANCELLED'
                "
                class="order-action order-action--check"
                size="small"
                @click="openCheck(row as OrderRegisterPaymentItem)"
              >
                <el-icon><CircleCheck /></el-icon>核对
              </el-button>
              <span v-else class="payment-check-state">
                {{ row.paymentStatusCode === 'CHECKED' ? '已核对' : '-' }}
              </span>
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
          @current-change="loadPayments"
        />
      </div>
    </el-card>

    <PaymentCheckDialog v-model="checkVisible" :payment="checkTarget" @checked="onChecked" />
    <PaymentDetailDrawer v-model="paymentDetailVisible" :payment="selectedPayment" />
    <OrderRegisterDetailDrawer v-model="detailVisible" :order-id="detailOrderId" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import OrderRegisterDetailDrawer from './components/OrderRegisterDetailDrawer.vue'
import PaymentDetailDrawer from './components/PaymentDetailDrawer.vue'
import PaymentCheckDialog from './components/PaymentCheckDialog.vue'
import TableColumnSettings from '@/components/supply/TableColumnSettings.vue'
import FundAttachmentThumbnails from '@/components/supply/FundAttachmentThumbnails.vue'
import { displayDateTime } from '@/utils/business-date'
import { CircleCheck } from '@element-plus/icons-vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  moneyText,
  paymentRecordStatusLabel,
  paymentRecordStatusTag,
} from '@/utils/order-register-status'
import { dateRangeParams, empty, orderRegisterDateParams } from '@/utils/order-register-query'
import { csvFilename, downloadBlob } from '@/utils/file-download'
import { vClearFilterOnEmptyInput } from '@/utils/filter-select-clear'
import { auditActorLabel } from '@/utils/audit-actor'
import {
  exportOrderRegisterCsv,
  getOrderRegisterPayments,
  type OrderRegisterPaymentItem,
  type OrderRegisterPaymentPage,
} from '@/api/core/order-register'
import { useOrderRegisterCommonFilters } from '@/composables/useOrderRegisterQuery'
import { useOrderRegisterOptions } from '@/composables/useOrderRegisterOptions'
import { useColumnSettings } from '@/composables/useColumnSettings'

const route = useRoute()
const paymentColumns = useColumnSettings('order-payments', [
  { key: 'customerName', label: '客户名称', locked: true },
  { key: 'regionName', label: '归属地区' },
  { key: 'ownerEmployee', label: '业务员' },
  { key: 'departmentName', label: '部门' },
  { key: 'orderAmount', label: '订单金额' },
  { key: 'paidAmount', label: '收款金额' },
  { key: 'paymentTime', label: '收款时间' },
  { key: 'paymentStatus', label: '收款状态' },
  { key: 'checkedStatus', label: '核对状态' },
  { key: 'checkedBy', label: '核对人' },
  { key: 'transactionNo', label: '交易单号' },
  { key: 'attachments', label: '付款凭证' },
  { key: 'createdBy', label: '创建人', defaultVisible: false },
  { key: 'createdTime', label: '创建时间', defaultVisible: false },
  { key: 'updatedBy', label: '修改人', defaultVisible: false },
  { key: 'updatedTime', label: '修改时间', defaultVisible: false },
  { key: 'syncedBy', label: '同步人', defaultVisible: false },
  { key: 'syncedAt', label: '同步时间', defaultVisible: false },
  { key: 'sourceRecordId', label: '来源回款号', defaultVisible: false },
  { key: 'dhbOrderNo', label: '订货宝订单号', defaultVisible: false },
  { key: 'checkedAt', label: '核对时间', defaultVisible: false },
])
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

const detailVisible = ref(false)
const detailOrderId = ref<string | number | null>(null)

const paymentDetailVisible = ref(false)
const selectedPayment = ref<OrderRegisterPaymentItem | null>(null)

const { can } = useSupplyPermissions()
const canCheckPayments = computed(() => can('order:payment:check'))
const checkVisible = ref(false)
const checkTarget = ref<OrderRegisterPaymentItem | null>(null)

/** 待收金额 = 应收（当前条件下订单金额） - 实收（已回款）。 */
const receivablePending = computed(
  () =>
    Number(pageData.value.totals.relatedOrderAmount || 0) -
    Number(pageData.value.totals.receivedAmount || 0),
)

function openCheck(row: OrderRegisterPaymentItem) {
  checkTarget.value = row
  checkVisible.value = true
}

function onChecked() {
  void loadPayments()
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
    includeSubDepartments: filters.includeSubDepartments,
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
    ElMessage.error(errorMessage(reason, '订单回款加载失败，请稍后重试'))
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

function openPaymentDetail(row: OrderRegisterPaymentItem) {
  selectedPayment.value = row
  paymentDetailVisible.value = true
}

async function exportCsv() {
  exporting.value = true
  try {
    const query = buildQuery()
    const params: Record<string, unknown> = { ...query }
    delete params.begin
    delete params.step
    const blob = await exportOrderRegisterCsv('payments', params)
    downloadBlob(blob, csvFilename('订单回款'))
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

/** 归属地区变化时清空业务员并按地区级联重载业务员选项。 */
watch(
  () => filters.regionCode,
  (value) => {
    filters.ownerEmployeeCode = ''
    void searchEmployees('', value)
  },
)

onMounted(() => {
  void loadOptions()
  if (!route.query.orderNo) void loadPayments()
})
</script>

<style scoped>
.order-register-page {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

/* 查询区不加卡片外框：条件与操作按钮直接落在页面背景上，留白更宽敞。 */
.supply-page.order-register-page > .filter-card {
  margin-bottom: 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.supply-page.order-register-page > .filter-card :deep(.el-card__body) {
  padding: 0;
}

/* 金额统计条与订单列表同一套视觉：指标条紧贴表格卡片上沿。 */
.order-summary {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  min-height: 60px;
  padding: 14px 20px;
  border: 1px solid var(--supply-border);
  border-bottom: 0;
  border-radius: var(--supply-radius) var(--supply-radius) 0 0;
  background: var(--supply-surface);
}

.order-summary__metric {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 0 28px;
  border-left: 1px solid var(--supply-border);
}

.order-summary__metric:first-child {
  padding-left: 0;
  border-left: 0;
}

.order-summary__label {
  color: var(--supply-text);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.order-summary__value {
  font-size: 21px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.order-summary__metric:nth-child(1) .order-summary__value {
  color: #2563eb;
}

.order-summary__metric:nth-child(2) .order-summary__value {
  color: #059669;
}

.order-summary__metric:nth-child(3) .order-summary__value {
  color: #d97706;
}

.order-summary__metric:nth-child(4) .order-summary__value {
  color: #64748b;
}

.supply-page.order-register-page > .list-card {
  border-radius: 0 0 var(--supply-radius) var(--supply-radius);
}

/* 表头加粗放大，长列表滚动时更容易定位列。 */
.order-register-table :deep(.el-table__header-wrapper tr th.el-table__cell) {
  color: var(--supply-text);
  font-size: 13px;
  font-weight: 700;
}
.order-no-cell {
  font-weight: 600;
}

/* 核对按钮与订单列表行操作同一套浅底语义色。 */
.order-action {
  height: 26px;
  min-height: 26px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 12px;
}

.order-action .el-icon {
  margin-right: 4px;
  font-size: 13px;
}

.order-action--check {
  border-color: #a7f3d0;
  background: #ecfdf5;
  color: #047857;
}

.order-action:hover {
  filter: brightness(0.96);
}

.payment-check-state {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.column-header-hint {
  border-bottom: 1px dashed var(--el-border-color);
  cursor: help;
}

/* 状态用语义色圆点 + 文本，与订单列表同一套视觉；颜色只承担状态含义。 */
.status-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--supply-text);
  font-size: 13px;
}

.status-dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
}

.status-dot--success {
  background: #059669;
}

.status-dot--primary {
  background: #2563eb;
}

.status-dot--warning {
  background: #d97706;
}

.status-dot--danger {
  background: #dc2626;
}

.status-dot--info {
  background: #94a3b8;
}
</style>
