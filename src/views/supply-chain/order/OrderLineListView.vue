<template>
  <div class="order-register-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">订单管理 · 订单明细</span>
        <SupplyPageTitle>订单明细</SupplyPageTitle>
        <p>一行是一条订单商品明细，金额来自来源成交口径，不跨单位汇总数量。</p>
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
        <el-input v-model="pageFilters.productCode" aria-label="商品编码" clearable placeholder="商品编码" style="width: 150px" @keyup.enter="search" />
        <el-input v-model="pageFilters.productKeyword" aria-label="商品名称" clearable placeholder="商品名称" style="width: 170px" @keyup.enter="search" />
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
        <h2>明细列表</h2>
        <span class="result-count"><strong>{{ pageData.total }}</strong> 条</span>
      </div>
      <div class="result-totals">
        <span>明细金额合计 <strong>{{ moneyText(pageData.totals.lineAmount) }}</strong></span>
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
          :default-sort="{ prop: 'orderDate', order: 'descending' }"
          @sort-change="changeSort"
        >
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
          <el-table-column prop="productCode" label="商品编码" width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ row.productCode || '-' }}</template>
          </el-table-column>
          <el-table-column prop="productName" label="商品名称" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.productName || '-' }}</template>
          </el-table-column>
          <el-table-column prop="specification" label="规格" width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.specification || '-' }}</template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="80">
            <template #default="{ row }">{{ row.unit || '-' }}</template>
          </el-table-column>
          <el-table-column label="数量" width="100" align="right" prop="quantity">
            <template #default="{ row }">{{ numberText(row.quantity) }}</template>
          </el-table-column>
          <el-table-column label="单价" width="110" align="right" prop="unitPrice">
            <template #default="{ row }">{{ moneyText(row.unitPrice) }}</template>
          </el-table-column>
          <el-table-column label="明细金额" width="130" align="right" sortable="custom" prop="lineAmount">
            <template #default="{ row }"><strong>{{ moneyText(row.lineAmount) }}</strong></template>
          </el-table-column>
          <el-table-column label="下单时间" width="170" sortable="custom" prop="orderDate">
            <template #default="{ row }">{{ displayDateTime(row.orderDate) }}</template>
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
          @current-change="loadLines"
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
import { displayDateTime } from '@/utils/business-date'
import { moneyText, numberText } from '@/utils/order-register-status'
import { empty, orderRegisterDateParams } from '@/utils/order-register-query'
import { csvFilename, downloadBlob } from '@/utils/file-download'
import {
  exportOrderRegisterCsv,
  getOrderRegisterLines,
  type OrderRegisterCoverage,
  type OrderRegisterLinePage,
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
  productKeyword: '',
  productCode: '',
})

const loading = ref(false)
const exporting = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const sortBy = ref<'orderDate' | 'lineAmount' | 'orderNo'>('orderDate')
const sortDirection = ref<'asc' | 'desc'>('desc')
const pageData = ref<OrderRegisterLinePage>({
  total: 0,
  begin: 0,
  step: 20,
  items: [],
  totals: { lineAmount: 0 },
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
      ? `历史数据仅可从 ${coverage.coverageFrom} 起准确回溯，此前范围不完整。`
      : '历史数据覆盖不完整，明细统计不能视为已确认完整。'
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
    productKeyword: empty(pageFilters.productKeyword),
    productCode: empty(pageFilters.productCode),
    sortBy: sortBy.value,
    sortDirection: sortDirection.value,
    ...dateParams,
  }
}

async function loadLines() {
  loading.value = true
  try {
    pageData.value = await getOrderRegisterLines(buildQuery())
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '订单明细加载失败，请稍后重试'))
  } finally {
    loading.value = false
  }
}

function search() {
  currentPage.value = 1
  void loadLines()
}

function resetFilters() {
  resetCommonFilters()
  pageFilters.productKeyword = ''
  pageFilters.productCode = ''
  sortBy.value = 'orderDate'
  sortDirection.value = 'desc'
  search()
}

function onPageSizeChange() {
  currentPage.value = 1
  void loadLines()
}

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

function changeSort({ prop, order }: { prop: string | null; order: string | null }) {
  const allowed = new Set(['orderDate', 'lineAmount', 'orderNo'])
  if (prop && allowed.has(prop)) {
    sortBy.value = prop as typeof sortBy.value
    sortDirection.value = order === 'ascending' ? 'asc' : 'desc'
  } else {
    sortBy.value = 'orderDate'
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
    const blob = await exportOrderRegisterCsv('lines', params)
    downloadBlob(blob, csvFilename('订单明细'))
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
  if (!route.query.orderNo) void loadLines()
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
}
.result-totals strong {
  color: var(--el-text-color-primary);
}
.order-no-cell {
  font-weight: 600;
}
</style>
