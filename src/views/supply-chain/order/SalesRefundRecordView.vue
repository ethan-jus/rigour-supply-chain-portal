<template>
  <div class="sales-refund-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">Order · 退款中心</span>
        <h1>销售退款</h1>
        <p>查看销售订单对应的退款记录、退款方式、退款状态、退款人和金额。</p>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="loadRows">
        <el-form-item label="退款单号">
          <el-input v-model="filters.refundNo" clearable placeholder="退款单号" style="width: 170px" />
        </el-form-item>
        <el-form-item label="销售订单号">
          <el-input v-model="filters.salesOrderNo" clearable placeholder="销售订单号" style="width: 170px" />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="filters.customerName" clearable placeholder="客户名称" style="width: 200px" />
        </el-form-item>
        <el-form-item label="退款人员">
          <el-input v-model="filters.refundStaffCode" clearable placeholder="员工编码" style="width: 160px" />
        </el-form-item>
        <el-form-item label="退款状态">
          <el-select v-model="filters.refundStatusCode" clearable placeholder="全部状态" style="width: 140px">
            <el-option v-for="item in refundStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="退款方式">
          <el-select v-model="filters.refundMethodCode" clearable placeholder="全部方式" style="width: 140px">
            <el-option v-for="item in paymentMethodOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="result-heading">
      <div class="result-title-line">
        <h2>退款列表</h2>
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
          <el-table-column prop="refundNo" label="退款单号" width="170" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.refundNo || '-' }}</template>
          </el-table-column>
          <el-table-column prop="salesOrderNoSnapshot" label="销售订单号" width="170" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.salesOrderNoSnapshot || '-' }}</template>
          </el-table-column>
          <el-table-column prop="customerNameSnapshot" label="客户名称" min-width="220" show-overflow-tooltip>
            <template #default="scope">
              <div class="record-identity">
                <span class="record-avatar">退</span>
                <div class="record-identity-content">
                  <strong>{{ scope.row.customerNameSnapshot || '-' }}</strong>
                  <small>{{ scope.row.customerCodeSnapshot || '-' }}</small>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="refundAmount" label="退款金额" width="140" align="right">
            <template #default="scope">¥{{ formatAmount(scope.row.refundAmount) }}</template>
          </el-table-column>
          <el-table-column prop="refundStatusCode" label="退款状态" width="120">
            <template #default="scope">{{ refundStatusLabel(scope.row.refundStatusCode) }}</template>
          </el-table-column>
          <el-table-column prop="refundMethodCode" label="退款方式" width="130">
            <template #default="scope">{{ paymentMethodLabel(scope.row.refundMethodCode) }}</template>
          </el-table-column>
          <el-table-column prop="refundStaffCode" label="退款人员" width="160" show-overflow-tooltip>
            <template #default="scope">
              {{ scope.row.refundStaffNameSnapshot || scope.row.refundStaffCode || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="refundTime" label="退款时间" width="180">
            <template #default="scope">{{ formatTime(scope.row.refundTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
              <el-button link type="danger" @click.stop="deleteRow(scope.row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无销售退款" /></template>
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

    <el-drawer v-model="detailVisible" class="sales-refund-detail-drawer" size="min(760px, 94vw)" :with-header="false">
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>退款详情</span>
            <h2>{{ detail.refundNo }}</h2>
            <p>{{ detail.salesOrderNoSnapshot || '-' }} · ¥{{ formatAmount(detail.refundAmount) }}</p>
          </div>
          <el-button circle plain aria-label="关闭退款详情" @click="detailVisible = false">×</el-button>
        </header>
        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="退款单号">{{ detail.refundNo }}</el-descriptions-item>
            <el-descriptions-item label="销售订单号">{{ detail.salesOrderNoSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户名称">{{ detail.customerNameSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户编码">{{ detail.customerCodeSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="退款金额">¥{{ formatAmount(detail.refundAmount) }}</el-descriptions-item>
            <el-descriptions-item label="退款状态">{{ refundStatusLabel(detail.refundStatusCode) }}</el-descriptions-item>
            <el-descriptions-item label="退款方式">{{ paymentMethodLabel(detail.refundMethodCode) }}</el-descriptions-item>
            <el-descriptions-item label="退款人员">
              {{ detail.refundStaffNameSnapshot || detail.refundStaffCode || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="员工编码">{{ detail.refundStaffCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="退款时间">{{ formatTime(detail.refundTime) }}</el-descriptions-item>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteSalesRefund,
  getSalesRefund,
  getSalesRefunds,
  type OrderPage,
  type SalesRefundDetail,
  type SalesRefundSummary,
} from '@/api/core/order-sales'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'

const paymentMethodOptions = computed(() => businessDictionaryOptions('ORDER', 'PAYMENT_METHOD'))
const refundStatusOptions = computed(() => businessDictionaryOptions('ORDER', 'SALES_REFUND_STATUS'))

const loading = ref(false)
const detailVisible = ref(false)
const detail = ref<SalesRefundDetail | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<OrderPage<SalesRefundSummary>>({ total: 0, begin: 0, step: 20, items: [] })

const filters = reactive({
  refundNo: '',
  salesOrderNo: '',
  customerName: '',
  refundStaffCode: '',
  refundMethodCode: '',
  refundStatusCode: '',
})

onMounted(() => {
  void loadBusinessDictionaries([
    { moduleCode: 'ORDER', code: 'PAYMENT_METHOD' },
    { moduleCode: 'ORDER', code: 'SALES_REFUND_STATUS' },
  ])
  void loadRows()
})

async function loadRows() {
  loading.value = true
  try {
    pageData.value = await getSalesRefunds({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      refundNo: empty(filters.refundNo),
      salesOrderNo: empty(filters.salesOrderNo),
      customerName: empty(filters.customerName),
      refundStaffCode: empty(filters.refundStaffCode),
      refundMethodCode: empty(filters.refundMethodCode),
      refundStatusCode: empty(filters.refundStatusCode),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售退款列表加载失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.refundNo = ''
  filters.salesOrderNo = ''
  filters.customerName = ''
  filters.refundStaffCode = ''
  filters.refundMethodCode = ''
  filters.refundStatusCode = ''
  currentPage.value = 1
  void loadRows()
}

function handleSizeChange() {
  currentPage.value = 1
  void loadRows()
}

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

async function openDetail(row: SalesRefundSummary) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getSalesRefund(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售退款详情加载失败'))
  }
}

async function deleteRow(row: SalesRefundSummary) {
  try {
    await ElMessageBox.confirm(`确认删除退款记录「${row.refundNo}」？删除后会重新汇总销售订单收款状态。`, '删除退款记录', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteSalesRefund(row.id, row.revision)
    ElMessage.success('退款记录已删除')
    await loadRows()
  } catch (reason) {
    if (reason !== 'cancel') ElMessage.error(errorMessage(reason, '删除失败'))
  }
}

function paymentMethodLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ORDER', 'PAYMENT_METHOD', value, '退款方式')
}

function refundStatusLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ORDER', 'SALES_REFUND_STATUS', value, '退款状态')
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
.sales-refund-page {
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

.record-identity {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.record-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #fff1f2;
  color: #e11d48;
  font-weight: 700;
}

.record-identity-content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  line-height: 1.35;
}

.record-identity-content strong,
.record-identity-content small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-identity-content small {
  color: #64748b;
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
  background: #9f1239;
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
