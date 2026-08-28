<template>
  <div class="sales-payment-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">Order · 收款中心</span>
        <h1>销售回款</h1>
        <p>查看销售订单对应的回款记录、回款方式、回款人和金额。</p>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="loadRows">
        <el-form-item label="回款单号">
          <el-input v-model="filters.paymentNo" clearable placeholder="回款单号" style="width: 170px" />
        </el-form-item>
        <el-form-item label="销售订单号">
          <el-input v-model="filters.salesOrderNo" clearable placeholder="销售订单号" style="width: 170px" />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="filters.customerName" clearable placeholder="客户名称" style="width: 200px" />
        </el-form-item>
        <el-form-item label="回款人员">
          <el-input v-model="filters.collectorStaffCode" clearable placeholder="员工编码" style="width: 160px" />
        </el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="filters.paymentMethodCode" clearable placeholder="全部方式" style="width: 140px">
            <el-option v-for="item in paymentMethodOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="回款时间">
          <el-date-picker
            v-model="filters.paymentTimeRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="截止日期"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="result-heading">
      <div class="result-title-line">
        <h2>回款列表</h2>
        <span class="result-count"><strong>{{ pageData.total }}</strong> 条</span>
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
          <el-table-column prop="paymentNo" label="回款单号" width="170" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.paymentNo || '-' }}</template>
          </el-table-column>
          <el-table-column prop="salesOrderNoSnapshot" label="销售订单号" width="170" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.salesOrderNoSnapshot || '-' }}</template>
          </el-table-column>
          <el-table-column prop="customerNameSnapshot" label="客户名称" min-width="220" show-overflow-tooltip>
            <template #default="scope">
              <span class="record-name">{{ scope.row.customerNameSnapshot || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="paidAmount" label="回款金额" width="140" align="right">
            <template #default="scope">¥{{ formatAmount(scope.row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column prop="paymentMethodCode" label="付款方式" width="130">
            <template #default="scope">{{ paymentMethodLabel(scope.row.paymentMethodCode) }}</template>
          </el-table-column>
          <el-table-column prop="collectorStaffCode" label="回款人员" width="160" show-overflow-tooltip>
            <template #default="scope">
              {{ scope.row.collectorNameSnapshot || scope.row.collectorStaffCode || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="paymentTime" label="回款时间" width="180">
            <template #default="scope">{{ formatTime(scope.row.paymentTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
              <el-button v-if="!isExternalSource(scope.row)" link type="danger" @click.stop="deleteRow(scope.row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无销售回款" /></template>
        </el-table>
      </div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="pageData.total"
          @current-change="loadRows"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" class="sales-payment-detail-drawer" size="min(760px, 94vw)" :with-header="false">
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>回款详情</span>
            <h2>{{ detail.paymentNo }}</h2>
            <p>{{ detail.salesOrderNoSnapshot || '-' }} · ¥{{ formatAmount(detail.paidAmount) }}</p>
          </div>
          <el-button circle plain aria-label="关闭回款详情" @click="detailVisible = false">×</el-button>
        </header>
        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="回款单号">{{ detail.paymentNo }}</el-descriptions-item>
            <el-descriptions-item label="销售订单号">{{ detail.salesOrderNoSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户名称">{{ detail.customerNameSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户编码">{{ detail.customerCodeSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="回款金额">¥{{ formatAmount(detail.paidAmount) }}</el-descriptions-item>
            <el-descriptions-item label="付款方式">{{ paymentMethodLabel(detail.paymentMethodCode) }}</el-descriptions-item>
            <el-descriptions-item label="回款人员">
              {{ detail.collectorNameSnapshot || detail.collectorStaffCode || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="员工编码">{{ detail.collectorStaffCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="回款时间">{{ formatTime(detail.paymentTime) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(detail.updatedTime) }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      <el-skeleton v-else :rows="8" animated />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteSalesPayment,
  getSalesPayment,
  getSalesPayments,
  type OrderPage,
  type SalesPaymentDetail,
  type SalesPaymentSummary,
} from '@/api/core/order-sales'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'

const paymentMethodOptions = computed(() => businessDictionaryOptions('ORDER', 'PAYMENT_METHOD'))
const route = useRoute()

const loading = ref(false)
const detailVisible = ref(false)
const detail = ref<SalesPaymentDetail | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<OrderPage<SalesPaymentSummary>>({ total: 0, begin: 0, step: 20, items: [] })

const filters = reactive({
  paymentNo: '',
  salesOrderNo: '',
  customerName: '',
  collectorStaffCode: '',
  paymentMethodCode: '',
  paymentTimeRange: [] as string[],
})

onMounted(() => {
  void loadBusinessDictionaries([{ moduleCode: 'ORDER', code: 'PAYMENT_METHOD' }])
  applyRouteQuery()
  void loadRows()
})

watch(() => route.query, () => {
  if (!applyRouteQuery()) return
  currentPage.value = 1
  void loadRows()
})

async function loadRows() {
  loading.value = true
  try {
    pageData.value = await getSalesPayments({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      paymentNo: empty(filters.paymentNo),
      salesOrderNo: empty(filters.salesOrderNo),
      customerName: empty(filters.customerName),
      collectorStaffCode: empty(filters.collectorStaffCode),
      paymentMethodCode: empty(filters.paymentMethodCode),
      paymentTimeFrom: startOfDay(filters.paymentTimeRange[0]),
      paymentTimeTo: endOfDay(filters.paymentTimeRange[1]),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售回款列表加载失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.paymentNo = ''
  filters.salesOrderNo = ''
  filters.customerName = ''
  filters.collectorStaffCode = ''
  filters.paymentMethodCode = ''
  filters.paymentTimeRange = []
  currentPage.value = 1
  void loadRows()
}

function applyRouteQuery() {
  let changed = false
  changed = setFilterValue('collectorStaffCode', routeText(route.query.collectorStaffCode)) || changed
  const from = routeDate(route.query.paymentTimeFrom)
  const to = routeDate(route.query.paymentTimeTo)
  const nextRange = from || to ? [from, to].filter(Boolean) : []
  if (filters.paymentTimeRange.join('|') !== nextRange.join('|')) {
    filters.paymentTimeRange = nextRange
    changed = true
  }
  return changed
}

function setFilterValue(key: 'paymentNo' | 'salesOrderNo' | 'customerName' | 'collectorStaffCode' | 'paymentMethodCode', value: string) {
  if (filters[key] === value) return false
  filters[key] = value
  return true
}

function routeText(value: unknown) {
  const normalized = Array.isArray(value) ? value[0] : value
  return typeof normalized === 'string' ? normalized.trim() : ''
}

function routeDate(value: unknown) {
  const text = routeText(value)
  return text ? text.slice(0, 10) : ''
}

function handleSizeChange() {
  currentPage.value = 1
  void loadRows()
}

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

async function openDetail(row: SalesPaymentSummary) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getSalesPayment(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售回款详情加载失败'))
  }
}

async function deleteRow(row: SalesPaymentSummary) {
  if (isExternalSource(row)) {
    ElMessage.warning('外部来源销售回款仅支持查看')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除回款记录「${row.paymentNo}」？删除后会重新汇总销售订单收款状态。`, '删除回款记录', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteSalesPayment(row.id, row.revision)
    ElMessage.success('回款记录已删除')
    await loadRows()
  } catch (reason) {
    if (reason !== 'cancel') ElMessage.error(errorMessage(reason, '删除失败'))
  }
}

function isExternalSource(row: Pick<SalesPaymentSummary, 'sourceSystemCode'>) {
  return Boolean(row.sourceSystemCode && row.sourceSystemCode.trim())
}

function paymentMethodLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ORDER', 'PAYMENT_METHOD', value, '付款方式')
}

function formatAmount(value: number | null | undefined): string {
  return Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function startOfDay(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00+08:00`).toISOString() : undefined
}

function endOfDay(value: string | undefined) {
  return value ? new Date(`${value}T23:59:59+08:00`).toISOString() : undefined
}

function empty(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof Error && reason.message) return reason.message
  return fallback
}
</script>

<style scoped>
.sales-payment-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card,
.list-card {
  border-radius: 6px;
}

.filter-actions {
  margin-left: auto;
}

.result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-title-line {
  display: flex;
  align-items: center;
  gap: 12px;
}

.result-title-line h2 {
  margin: 0;
  font-size: 18px;
}

.result-count {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: #eef4ff;
  color: #2563eb;
}

.table-viewport {
  height: min(620px, calc(100vh - 360px));
  min-height: 420px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

.detail-shell {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}

.detail-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  color: #fff;
  background: #0f766e;
}

.detail-hero span {
  font-size: 13px;
  opacity: 0.85;
}

.detail-hero h2 {
  margin: 6px 0;
  font-size: 26px;
}

.detail-hero p {
  margin: 0;
  opacity: 0.9;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 24px;
}
</style>
