<template>
  <div class="fund-document-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">Order · 客户资金</span>
        <h1>客户资金流水</h1>
        <p>查看客户充值、订单收款、余额抵扣等资金流水，订货宝付款单不按销售退款处理。</p>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="loadRows">
        <el-form-item label="资金方向">
          <el-select v-model="filters.directionCode" clearable placeholder="全部方向" style="width: 130px">
            <el-option v-for="item in directionOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="单据编号">
          <el-input v-model="filters.documentNo" clearable placeholder="单据编号" style="width: 170px" />
        </el-form-item>
        <el-form-item label="销售订单号">
          <el-input v-model="filters.salesOrderNo" clearable placeholder="销售订单号" style="width: 170px" />
        </el-form-item>
        <el-form-item label="往来方">
          <el-input v-model="filters.counterpartyName" clearable placeholder="客户/往来方" style="width: 190px" />
        </el-form-item>
        <el-form-item label="经办人员">
          <el-input v-model="filters.handlerStaffCode" clearable placeholder="员工编码" style="width: 150px" />
        </el-form-item>
        <el-form-item label="业务类型">
          <el-select v-model="filters.businessTypeCode" clearable placeholder="全部类型" style="width: 150px">
            <el-option v-for="item in businessTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="单据状态">
          <el-select v-model="filters.documentStatusCode" clearable placeholder="全部状态" style="width: 130px">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
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
        <h2>客户资金流水列表</h2>
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
          <el-table-column prop="documentNo" label="单据编号" width="170" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.documentNo || '-' }}</template>
          </el-table-column>
          <el-table-column prop="directionCode" label="方向" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.directionCode === 'PAYMENT' ? 'warning' : 'success'" effect="light">
                {{ directionLabel(scope.row.directionCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额" width="140" align="right">
            <template #default="scope">¥{{ formatAmount(scope.row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="counterpartyNameSnapshot" label="往来方" min-width="220" show-overflow-tooltip>
            <template #default="scope">
              <div class="record-identity">
                <span class="record-avatar">{{ scope.row.directionCode === 'PAYMENT' ? '付' : '收' }}</span>
                <div class="record-identity-content">
                  <strong>{{ scope.row.counterpartyNameSnapshot || scope.row.customerNameSnapshot || '-' }}</strong>
                  <small>{{ scope.row.counterpartyCodeSnapshot || scope.row.customerCodeSnapshot || '-' }}</small>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="salesOrderNoSnapshot" label="销售订单号" width="170" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.salesOrderNoSnapshot || '-' }}</template>
          </el-table-column>
          <el-table-column prop="businessTypeCode" label="业务类型" width="130">
            <template #default="scope">{{ businessTypeLabel(scope.row.businessTypeCode) }}</template>
          </el-table-column>
          <el-table-column prop="settlementMethodCode" label="结算方式" width="130">
            <template #default="scope">{{ paymentMethodLabel(scope.row.settlementMethodCode) }}</template>
          </el-table-column>
          <el-table-column prop="documentStatusCode" label="状态" width="110">
            <template #default="scope">{{ statusLabel(scope.row.documentStatusCode) }}</template>
          </el-table-column>
          <el-table-column prop="handlerStaffCode" label="经办人员" width="150" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.handlerStaffNameSnapshot || scope.row.handlerStaffCode || '-' }}</template>
          </el-table-column>
          <el-table-column prop="occurredTime" label="发生时间" width="180">
            <template #default="scope">{{ formatTime(scope.row.occurredTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="110" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无客户资金流水" /></template>
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

    <el-drawer v-model="detailVisible" class="fund-document-detail-drawer" size="min(760px, 94vw)" :with-header="false">
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>客户资金流水详情</span>
            <h2>{{ detail.documentNo }}</h2>
            <p>{{ directionLabel(detail.directionCode) }} · ¥{{ formatAmount(detail.amount) }}</p>
          </div>
          <el-button circle plain aria-label="关闭资金单据详情" @click="detailVisible = false">×</el-button>
        </header>
        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="单据编号">{{ detail.documentNo }}</el-descriptions-item>
            <el-descriptions-item label="资金方向">{{ directionLabel(detail.directionCode) }}</el-descriptions-item>
            <el-descriptions-item label="金额">¥{{ formatAmount(detail.amount) }}</el-descriptions-item>
            <el-descriptions-item label="单据状态">{{ statusLabel(detail.documentStatusCode) }}</el-descriptions-item>
            <el-descriptions-item label="业务类型">{{ businessTypeLabel(detail.businessTypeCode) }}</el-descriptions-item>
            <el-descriptions-item label="结算方式">{{ paymentMethodLabel(detail.settlementMethodCode) }}</el-descriptions-item>
            <el-descriptions-item label="销售订单号">{{ detail.salesOrderNoSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="往来方">{{ detail.counterpartyNameSnapshot || detail.customerNameSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="往来方编码">{{ detail.counterpartyCodeSnapshot || detail.customerCodeSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="经办人员">{{ detail.handlerStaffNameSnapshot || detail.handlerStaffCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="员工编码">{{ detail.handlerStaffCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="发生时间">{{ formatTime(detail.occurredTime) }}</el-descriptions-item>
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
import { ElMessage } from 'element-plus'
import {
  getFundDocument,
  getFundDocuments,
  type FundDocumentDetail,
  type FundDocumentSummary,
  type OrderPage,
} from '@/api/core/order-sales'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'

const directionOptions = computed(() => businessDictionaryOptions('ORDER', 'FUND_DOCUMENT_DIRECTION'))
const businessTypeOptions = computed(() => businessDictionaryOptions('ORDER', 'FUND_DOCUMENT_BUSINESS_TYPE'))
const statusOptions = computed(() => businessDictionaryOptions('ORDER', 'FUND_DOCUMENT_STATUS'))

const loading = ref(false)
const detailVisible = ref(false)
const detail = ref<FundDocumentDetail | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<OrderPage<FundDocumentSummary>>({ total: 0, begin: 0, step: 20, items: [] })

const filters = reactive({
  directionCode: '',
  documentNo: '',
  salesOrderNo: '',
  counterpartyName: '',
  handlerStaffCode: '',
  businessTypeCode: '',
  documentStatusCode: '',
})

onMounted(() => {
  void loadBusinessDictionaries([
    { moduleCode: 'ORDER', code: 'FUND_DOCUMENT_DIRECTION' },
    { moduleCode: 'ORDER', code: 'FUND_DOCUMENT_BUSINESS_TYPE' },
    { moduleCode: 'ORDER', code: 'FUND_DOCUMENT_STATUS' },
    { moduleCode: 'ORDER', code: 'PAYMENT_METHOD' },
  ])
  void loadRows()
})

async function loadRows() {
  loading.value = true
  try {
    pageData.value = await getFundDocuments({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      directionCode: empty(filters.directionCode),
      documentNo: empty(filters.documentNo),
      salesOrderNo: empty(filters.salesOrderNo),
      counterpartyName: empty(filters.counterpartyName),
      handlerStaffCode: empty(filters.handlerStaffCode),
      businessTypeCode: empty(filters.businessTypeCode),
      documentStatusCode: empty(filters.documentStatusCode),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '资金单据列表加载失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.directionCode = ''
  filters.documentNo = ''
  filters.salesOrderNo = ''
  filters.counterpartyName = ''
  filters.handlerStaffCode = ''
  filters.businessTypeCode = ''
  filters.documentStatusCode = ''
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

async function openDetail(row: FundDocumentSummary) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getFundDocument(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '资金单据详情加载失败'))
  }
}

function directionLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ORDER', 'FUND_DOCUMENT_DIRECTION', value, '资金方向')
}

function businessTypeLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ORDER', 'FUND_DOCUMENT_BUSINESS_TYPE', value, '业务类型')
}

function statusLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ORDER', 'FUND_DOCUMENT_STATUS', value, '单据状态')
}

function paymentMethodLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ORDER', 'PAYMENT_METHOD', value, '结算方式')
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
.fund-document-page {
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
  background: #f0f6ff;
  color: #2563eb;
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
</style>
