<template>
  <div class="fund-document-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">Order · 客户资金</span>
        <h1>客户资金流水</h1>
        <p>按收支明细口径查看客户资金来源、关联单据、支付流水和账户信息。</p>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="loadRows">
        <el-form-item label="收付款单号">
          <el-input v-model="filters.sourceDocumentNo" clearable placeholder="FR/FP 单号" style="width: 170px" />
        </el-form-item>
        <el-form-item label="关联单号">
          <el-input v-model="filters.sourceOrderNo" clearable placeholder="DH 订单号" style="width: 170px" />
        </el-form-item>
        <el-form-item label="支付流水号">
          <el-input v-model="filters.paymentSerialNo" clearable placeholder="银行/支付流水" style="width: 190px" />
        </el-form-item>
        <el-form-item label="我方单号">
          <el-input v-model="filters.documentNo" clearable placeholder="资金单号" style="width: 160px" />
        </el-form-item>
        <el-form-item label="收支时间">
          <el-date-picker
            v-model="filters.occurredTimeRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="截止日期"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="filters.counterpartyName" clearable placeholder="客户名称" style="width: 190px" />
        </el-form-item>
        <el-form-item label="收支类型">
          <el-select v-model="filters.businessTypeCode" clearable placeholder="全部类型" style="width: 150px">
            <el-option v-for="item in businessTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="支付方式">
          <el-select v-model="filters.settlementMethodCode" clearable placeholder="全部方式" style="width: 140px">
            <el-option v-for="item in paymentMethodOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="收支方向">
          <el-select v-model="filters.directionCode" clearable placeholder="全部方向" style="width: 130px">
            <el-option v-for="item in directionOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="单据状态">
          <el-select v-model="filters.documentStatusCode" clearable placeholder="全部状态" style="width: 130px">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="快速搜索">
          <el-input v-model="filters.keyword" clearable placeholder="任意单号/流水号" style="width: 190px" />
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
          <el-table-column prop="sourceDocumentNo" label="单号" width="180" show-overflow-tooltip>
            <template #default="scope">{{ primaryDocumentNo(scope.row) }}</template>
          </el-table-column>
          <el-table-column prop="occurredTime" label="收支时间" width="180">
            <template #default="scope">{{ formatTime(scope.row.occurredTime) }}</template>
          </el-table-column>
          <el-table-column prop="customerCodeSnapshot" label="客户编号" width="130" show-overflow-tooltip>
            <template #default="scope">{{ customerCode(scope.row) }}</template>
          </el-table-column>
          <el-table-column prop="customerNameSnapshot" label="客户名称" min-width="220" show-overflow-tooltip>
            <template #default="scope">
              <span class="record-name">{{ customerName(scope.row) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="businessTypeCode" label="收支类型" width="130">
            <template #default="scope">{{ businessTypeLabel(scope.row.businessTypeCode) }}</template>
          </el-table-column>
          <el-table-column prop="settlementMethodCode" label="支付方式" width="130">
            <template #default="scope">{{ paymentMethodLabel(scope.row.settlementMethodCode) }}</template>
          </el-table-column>
          <el-table-column prop="amount" label="收入" width="130" align="right">
            <template #default="scope">
              <span class="money-cell money-cell--income">{{ incomeAmount(scope.row) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="支出" width="130" align="right">
            <template #default="scope">
              <span class="money-cell money-cell--expense">{{ expenseAmount(scope.row) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="sourceOrderNo" label="关联单号" width="180" show-overflow-tooltip>
            <template #default="scope">{{ linkedDocumentNo(scope.row) }}</template>
          </el-table-column>
          <el-table-column prop="documentStatusCode" label="收付状态" width="120">
            <template #default="scope">
              <el-tag :type="statusTagType(scope.row.documentStatusCode)" effect="light">
                {{ statusLabel(scope.row.documentStatusCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">查看</el-button>
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
            <h2>{{ primaryDocumentNo(detail) }}</h2>
            <p>{{ businessTypeLabel(detail.businessTypeCode) }} · {{ directionLabel(detail.directionCode) }} · ¥{{ formatAmount(detail.amount) }}</p>
          </div>
          <el-button circle plain aria-label="关闭资金单据详情" @click="detailVisible = false">×</el-button>
        </header>
        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="收付款单号">{{ primaryDocumentNo(detail) }}</el-descriptions-item>
            <el-descriptions-item label="我方资金单号">{{ detail.documentNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户名称">{{ customerName(detail) }}</el-descriptions-item>
            <el-descriptions-item label="客户编号">{{ customerCode(detail) }}</el-descriptions-item>
            <el-descriptions-item label="金额">¥{{ formatAmount(detail.amount) }}</el-descriptions-item>
            <el-descriptions-item :label="statusFieldLabel(detail)">{{ statusLabel(detail.documentStatusCode) }}</el-descriptions-item>
            <el-descriptions-item label="收支类型">{{ businessTypeLabel(detail.businessTypeCode) }}</el-descriptions-item>
            <el-descriptions-item label="关联单号">{{ linkedDocumentNo(detail) }}</el-descriptions-item>
            <el-descriptions-item label="支付方式">{{ paymentMethodLabel(detail.settlementMethodCode) }}</el-descriptions-item>
            <el-descriptions-item label="收支方向">{{ directionLabel(detail.directionCode) }}</el-descriptions-item>
            <el-descriptions-item label="付款日期">{{ formatDate(detail.occurredTime) }}</el-descriptions-item>
            <el-descriptions-item label="支付流水号">{{ detail.paymentSerialNo || '-' }}</el-descriptions-item>
            <el-descriptions-item :label="accountFieldLabel(detail)">{{ detail.bankAccountNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="开户名称">{{ detail.bankAccountName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="开户银行">{{ detail.bankName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ submittedDisplay(detail) }}</el-descriptions-item>
            <el-descriptions-item label="审核确认时间">{{ formatTime(detail.confirmedAt) }}</el-descriptions-item>
            <el-descriptions-item label="经办人员">{{ detail.handlerStaffNameSnapshot || detail.handlerStaffCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="员工编码">{{ detail.handlerStaffCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(detail.updatedTime) }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
            <el-descriptions-item label="附件" :span="2">
              <div v-if="attachmentItems(detail).length" class="attachment-list">
                <div v-for="item in attachmentItems(detail)" :key="item.objectKey" class="attachment-item">
                  <span class="attachment-name">{{ item.fileName || attachmentName(item.objectKey) }}</span>
                  <a v-if="item.url" :href="item.url" target="_blank" rel="noreferrer">查看</a>
                  <span v-else class="attachment-unavailable">仅来源引用</span>
                </div>
              </div>
              <span v-else>-</span>
            </el-descriptions-item>
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
  type FundDocumentAttachment,
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
const paymentMethodOptions = computed(() => businessDictionaryOptions('ORDER', 'PAYMENT_METHOD'))

const loading = ref(false)
const detailVisible = ref(false)
const detail = ref<FundDocumentDetail | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<OrderPage<FundDocumentSummary>>({ total: 0, begin: 0, step: 20, items: [] })

const filters = reactive({
  keyword: '',
  directionCode: '',
  documentNo: '',
  sourceDocumentNo: '',
  sourceOrderNo: '',
  paymentSerialNo: '',
  counterpartyName: '',
  settlementMethodCode: '',
  businessTypeCode: '',
  documentStatusCode: '',
  occurredTimeRange: [] as string[],
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
      keyword: empty(filters.keyword),
      directionCode: empty(filters.directionCode),
      documentNo: empty(filters.documentNo),
      sourceDocumentNo: empty(filters.sourceDocumentNo),
      sourceOrderNo: empty(filters.sourceOrderNo),
      paymentSerialNo: empty(filters.paymentSerialNo),
      counterpartyName: empty(filters.counterpartyName),
      settlementMethodCode: empty(filters.settlementMethodCode),
      businessTypeCode: empty(filters.businessTypeCode),
      documentStatusCode: empty(filters.documentStatusCode),
      occurredTimeFrom: startOfDay(filters.occurredTimeRange[0]),
      occurredTimeTo: endOfDay(filters.occurredTimeRange[1]),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '资金单据列表加载失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.keyword = ''
  filters.directionCode = ''
  filters.documentNo = ''
  filters.sourceDocumentNo = ''
  filters.sourceOrderNo = ''
  filters.paymentSerialNo = ''
  filters.counterpartyName = ''
  filters.settlementMethodCode = ''
  filters.businessTypeCode = ''
  filters.documentStatusCode = ''
  filters.occurredTimeRange = []
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
  return businessDictionaryLabel('ORDER', 'PAYMENT_METHOD', value, '支付方式')
}

function primaryDocumentNo(row: FundDocumentSummary) {
  return row.sourceDocumentNo || row.documentNo || '-'
}

function linkedDocumentNo(row: FundDocumentSummary) {
  return row.sourceOrderNo || row.salesOrderNoSnapshot || '-'
}

function customerCode(row: FundDocumentSummary) {
  return row.counterpartyCodeSnapshot || row.customerCodeSnapshot || '-'
}

function customerName(row: FundDocumentSummary) {
  return row.counterpartyNameSnapshot || row.customerNameSnapshot || '-'
}

function incomeAmount(row: FundDocumentSummary) {
  return row.directionCode === 'RECEIPT' ? `¥${formatAmount(row.amount)}` : '-'
}

function expenseAmount(row: FundDocumentSummary) {
  return row.directionCode === 'PAYMENT' ? `¥${formatAmount(row.amount)}` : '-'
}

function statusFieldLabel(row: FundDocumentSummary) {
  return row.directionCode === 'PAYMENT' ? '付款状态' : '收款状态'
}

function accountFieldLabel(row: FundDocumentSummary) {
  return row.directionCode === 'PAYMENT' ? '付款账号' : '收款账号'
}

function statusTagType(value: string | null | undefined) {
  const normalized = String(value || '').toUpperCase()
  if (normalized.includes('CONFIRM') || normalized.includes('PAID') || normalized.includes('RECEIVED')) return 'success'
  if (normalized.includes('PEND') || normalized.includes('WAIT')) return 'warning'
  if (normalized.includes('REJECT') || normalized.includes('FAIL')) return 'danger'
  return 'info'
}

function submittedDisplay(row: FundDocumentSummary) {
  const time = formatTime(row.submittedAt)
  const staff = row.handlerStaffNameSnapshot || row.handlerStaffCode || ''
  if (time !== '-' && staff) return `${time} ${staff}`
  return time !== '-' ? time : staff || '-'
}

function attachmentItems(row: FundDocumentDetail): FundDocumentAttachment[] {
  const result: FundDocumentAttachment[] = []
  const seen = new Set<string>()
  for (const item of row.attachments || []) {
    if (!item?.objectKey || seen.has(item.objectKey)) continue
    seen.add(item.objectKey)
    result.push(item)
  }
  for (const key of attachmentKeys(row)) {
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ objectKey: key, fileName: attachmentName(key), url: null })
  }
  return result
}

function attachmentKeys(row: FundDocumentDetail) {
  return Array.from(new Set([...(row.sourceAttachmentKeys || []), ...(row.voucherKeys || [])])).filter(Boolean)
}

function attachmentName(value: string) {
  try {
    const path = /^https?:\/\//i.test(value) ? new URL(value).pathname : value
    const name = path.split(/[\\/]/).filter(Boolean).pop()
    return name ? decodeURIComponent(name) : value
  } catch {
    return value
  }
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

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-')
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

.money-cell {
  font-variant-numeric: tabular-nums;
}

.money-cell--income {
  color: #047857;
}

.money-cell--expense {
  color: #b45309;
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
  gap: 16px;
  padding: 24px;
  color: #fff;
  background: #0f766e;
}

.detail-hero span {
  font-size: 13px;
  opacity: 0.85;
}

.detail-hero h2 {
  margin: 8px 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  word-break: break-word;
}

.detail-hero p {
  margin: 0;
  opacity: 0.9;
}

.detail-content {
  padding: 20px;
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.attachment-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
}

.attachment-name {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-list a {
  color: #2563eb;
  text-decoration: none;
}

.attachment-unavailable {
  color: #909399;
  font-size: 12px;
}

</style>
