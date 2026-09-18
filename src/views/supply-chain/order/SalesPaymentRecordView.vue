<template>
  <div class="sales-payment-page supply-page supply-page--business-main">
    <div class="page-heading">
      <HistoryOrderReview />
      <DhbPageSyncButton scope="RECEIPT" label="回款" @completed="loadRows" />
      <div>
        <span class="supply-page__eyebrow">Order · 收款中心</span>
        <SupplyPageTitle>销售回款</SupplyPageTitle>
        <p>查看销售订单对应的回款记录、回款方式、回款人和金额。</p>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="loadRows">
        <el-form-item label="回款单号">
          <el-input
            v-model="filters.paymentNo"
            clearable
            placeholder="回款单号"
            style="width: 170px"
          />
        </el-form-item>
        <el-form-item label="销售订单号">
          <el-input
            v-model="filters.salesOrderNo"
            clearable
            placeholder="系统订单号"
            style="width: 170px"
          />
        </el-form-item>
        <el-form-item label="来源单号">
          <el-input
            v-model="filters.sourceDocumentNo"
            clearable
            placeholder="飞书/DD单号"
            style="width: 170px"
          />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input
            v-model="filters.customerName"
            clearable
            placeholder="客户名称"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="回款人员">
          <el-input
            v-model="filters.collectorStaffCode"
            clearable
            placeholder="员工编码"
            style="width: 160px"
          />
        </el-form-item>
        <el-form-item label="付款方式">
          <el-select
            v-model="filters.paymentMethodCode"
            clearable
            placeholder="全部方式"
            style="width: 140px"
          >
            <el-option
              v-for="item in paymentMethodOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
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
        <span class="result-count"
          ><strong>{{ pageData.total }}</strong> 条</span
        >
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
          <el-table-column
            type="index"
            label="序号"
            width="80"
            fixed="left"
            :index="tableRowIndex"
          />
          <el-table-column prop="paymentNo" label="回款单号" width="170" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.paymentNo || '-' }}</template>
          </el-table-column>
          <el-table-column prop="sourceSystemCode" label="来源" width="110">
            <template #default="scope">
              <el-tag v-if="scope.row.sourceSystemCode" effect="plain">
                {{ sourceSystemLabel(scope.row.sourceSystemCode) }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="sourceDocumentNo"
            label="来源单号"
            width="170"
            show-overflow-tooltip
          >
            <template #default="scope">{{ scope.row.sourceDocumentNo || '-' }}</template>
          </el-table-column>
          <el-table-column
            prop="salesOrderNoSnapshot"
            label="销售订单号"
            width="170"
            show-overflow-tooltip
          >
            <template #default="scope">{{ scope.row.salesOrderNoSnapshot || '-' }}</template>
          </el-table-column>
          <el-table-column
            prop="customerNameSnapshot"
            label="客户名称"
            min-width="220"
            show-overflow-tooltip
          >
            <template #default="scope">
              <span class="record-name">{{ scope.row.customerNameSnapshot || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="paidAmount" label="回款金额" width="140" align="right">
            <template #default="scope">¥{{ formatAmount(scope.row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column prop="paymentMethodCode" label="付款方式" width="130">
            <template #default="scope">{{
              paymentMethodLabel(scope.row.paymentMethodCode)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="collectorStaffCode"
            label="回款人员"
            width="160"
            show-overflow-tooltip
          >
            <template #default="scope">
              {{ scope.row.collectorNameSnapshot || scope.row.collectorStaffCode || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="paymentTime" label="回款时间" width="180">
            <template #default="scope">{{ formatTime(scope.row.paymentTime) }}</template>
          </el-table-column>
          <!-- @vue-generic {SalesPaymentSummary} -->
          <el-table-column label="操作" width="150" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
              <el-button
                v-if="!isExternalSource(scope.row) && can('order:payment:delete', 'order:write')"
                link
                type="danger"
                @click.stop="deleteRow(scope.row)"
                >删除</el-button
              >
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

    <el-drawer
      v-model="detailVisible"
      class="sales-payment-detail-drawer"
      size="min(860px, 94vw)"
      :with-header="false"
    >
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div class="detail-hero-main">
            <span>回款详情</span>
            <h2>{{ detail.paymentNo }}</h2>
            <p>{{ detail.salesOrderNoSnapshot || '-' }} · ¥{{ formatAmount(detail.paidAmount) }}</p>
          </div>
          <el-button circle plain aria-label="关闭回款详情" @click="detailVisible = false"
            >×</el-button
          >
        </header>
        <div class="detail-content payment-detail-content">
          <div class="detail-summary payment-detail-summary">
            <div>
              <span>回款金额</span><strong>¥{{ formatAmount(detail.paidAmount) }}</strong>
            </div>
            <div>
              <span>回款时间</span><strong>{{ formatTime(detail.paymentTime) }}</strong>
            </div>
            <div>
              <span>付款方式</span
              ><strong>{{ paymentMethodLabel(detail.paymentMethodCode) }}</strong>
            </div>
            <div>
              <span>回款人员</span
              ><strong>{{
                detail.collectorNameSnapshot || detail.collectorStaffCode || '-'
              }}</strong>
            </div>
          </div>

          <section class="detail-panel">
            <div class="detail-section-heading">
              <div>
                <h3>单据信息</h3>
                <span>{{ sourceSystemLabel(detail.sourceSystemCode) }}</span>
              </div>
            </div>
            <div class="detail-field-grid">
              <div class="detail-field">
                <span>回款单号</span><strong>{{ detail.paymentNo }}</strong>
              </div>
              <div class="detail-field">
                <span>销售订单号</span><strong>{{ detail.salesOrderNoSnapshot || '-' }}</strong>
              </div>
              <div class="detail-field">
                <span>来源单号</span><strong>{{ detail.sourceDocumentNo || '-' }}</strong>
              </div>
              <div class="detail-field detail-field--wide">
                <span>客户名称</span><strong>{{ detail.customerNameSnapshot || '-' }}</strong>
              </div>
              <div class="detail-field">
                <span>客户编码</span><strong>{{ detail.customerCodeSnapshot || '-' }}</strong>
              </div>
              <div class="detail-field">
                <span>员工编码</span><strong>{{ detail.collectorStaffCode || '-' }}</strong>
              </div>
              <div class="detail-field">
                <span>更新时间</span><strong>{{ formatTime(detail.updatedTime) }}</strong>
              </div>
              <div class="detail-field detail-field--full">
                <span>备注</span><strong>{{ detail.remark || '-' }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-panel">
            <div class="detail-section-heading">
              <div>
                <h3>回款凭证</h3>
                <span>凭证 {{ paymentAttachmentItems(detail).length }} 个</span>
              </div>
            </div>
            <div class="payment-attachment-panel">
              <FundAttachmentPreviewList
                :attachments="paymentAttachmentItems(detail)"
                direction="row"
                empty-text="暂无回款凭证"
                unavailable-text="暂不可预览"
              />
            </div>
          </section>
        </div>
      </div>
      <el-skeleton v-else :rows="8" animated />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import HistoryOrderReview from '@/components/supply/HistoryOrderReview.vue'
import DhbPageSyncButton from '@/components/supply/DhbPageSyncButton.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
const { can } = useSupplyPermissions()
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import FundAttachmentPreviewList from '@/components/supply/FundAttachmentPreviewList.vue'
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
  sourceDocumentNo: '',
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

watch(
  () => route.query,
  () => {
    if (!applyRouteQuery()) return
    currentPage.value = 1
    void loadRows()
  },
)

async function loadRows() {
  loading.value = true
  try {
    pageData.value = await getSalesPayments({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      paymentNo: empty(filters.paymentNo),
      salesOrderNo: empty(filters.salesOrderNo),
      sourceDocumentNo: empty(filters.sourceDocumentNo),
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
  filters.sourceDocumentNo = ''
  filters.customerName = ''
  filters.collectorStaffCode = ''
  filters.paymentMethodCode = ''
  filters.paymentTimeRange = []
  currentPage.value = 1
  void loadRows()
}

function applyRouteQuery() {
  let changed = false
  changed = setFilterValue('paymentNo', routeText(route.query.paymentNo)) || changed
  changed = setFilterValue('salesOrderNo', routeText(route.query.salesOrderNo)) || changed
  changed = setFilterValue('sourceDocumentNo', routeText(route.query.sourceDocumentNo)) || changed
  changed = setFilterValue('customerName', routeText(route.query.customerName)) || changed
  changed =
    setFilterValue('collectorStaffCode', routeText(route.query.collectorStaffCode)) || changed
  changed = setFilterValue('paymentMethodCode', routeText(route.query.paymentMethodCode)) || changed
  const from = routeDate(route.query.paymentTimeFrom)
  const to = routeDate(route.query.paymentTimeTo)
  const nextRange = from || to ? [from, to].filter(Boolean) : []
  if (filters.paymentTimeRange.join('|') !== nextRange.join('|')) {
    filters.paymentTimeRange = nextRange
    changed = true
  }
  return changed
}

function setFilterValue(
  key:
    | 'paymentNo'
    | 'salesOrderNo'
    | 'sourceDocumentNo'
    | 'customerName'
    | 'collectorStaffCode'
    | 'paymentMethodCode',
  value: string,
) {
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
    await nextTick()
    scrollDetailToTop()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售回款详情加载失败'))
  }
}

function scrollDetailToTop() {
  const reset = () => {
    document.querySelector('.sales-payment-detail-drawer .el-drawer__body')?.scrollTo({ top: 0 })
  }
  reset()
  requestAnimationFrame(reset)
  window.setTimeout(reset, 0)
}

async function deleteRow(row: SalesPaymentSummary) {
  if (isExternalSource(row)) {
    ElMessage.warning('外部来源销售回款仅支持查看')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除回款记录「${row.paymentNo}」？删除后会重新汇总销售订单收款状态。`,
      '删除回款记录',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
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

function sourceSystemLabel(value: string | null | undefined) {
  if (value === 'FEISHU') return '飞书'
  if (value === 'DINGHUOBAO' || value === 'DHB') return '订货宝'
  return value || '-'
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

const formatTime = displayDateTime

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

function paymentAttachmentItems(row: SalesPaymentDetail) {
  const result = [...(row.attachments || [])]
  const existing = new Set(result.map((item) => item.objectKey))
  for (const key of row.voucherKeys || []) {
    if (!key || existing.has(key)) continue
    result.push({ objectKey: key, fileName: attachmentName(key), url: null })
  }
  return result
}

function attachmentName(value: string) {
  const normalized = value.split('?')[0] || value
  const parts = normalized.split(/[\\/]/)
  return parts[parts.length - 1] || normalized
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

.sales-payment-detail-drawer :deep(.el-drawer__body) {
  padding: 0;
}

.detail-shell {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  background: var(--supply-page-background, #f6f8fb);
}

.detail-hero {
  position: sticky;
  z-index: 4;
  top: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--supply-border, #e5e7eb);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
}

.detail-hero-main {
  min-width: 0;
}

.detail-hero span {
  color: var(--supply-primary, #2563eb);
  font-size: 13px;
  font-weight: 700;
}

.detail-hero h2 {
  overflow: hidden;
  margin: 6px 0;
  color: var(--supply-text, #111827);
  font-size: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-hero p {
  margin: 0;
  color: var(--supply-text-muted, #64748b);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 22px 24px;
}

.detail-summary {
  display: grid;
  gap: 10px;
}

.payment-detail-summary {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.detail-summary > div {
  min-width: 0;
  min-height: 78px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.detail-summary span,
.detail-summary strong {
  display: block;
  min-width: 0;
}

.detail-summary span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.detail-summary strong {
  margin-top: 6px;
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.detail-panel {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.detail-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.detail-section-heading h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.detail-section-heading span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.detail-field-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.detail-field {
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.detail-field span,
.detail-field strong {
  display: block;
  min-width: 0;
}

.detail-field span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.detail-field strong {
  margin-top: 6px;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.detail-field--wide {
  grid-column: span 2;
}

.detail-field--full {
  grid-column: 1 / -1;
}

.payment-attachment-panel {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

@media (max-width: 900px) {
  .payment-detail-summary,
  .detail-field-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-field--wide {
    grid-column: span 2;
  }
}

@media (max-width: 640px) {
  .detail-hero {
    flex-direction: column;
  }

  .payment-detail-summary,
  .detail-field-grid {
    grid-template-columns: 1fr;
  }

  .detail-field--wide {
    grid-column: auto;
  }
}
</style>
