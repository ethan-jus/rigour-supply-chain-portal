<template>
  <div class="sales-shipment-page supply-page supply-page--business-main">
    <div class="page-heading">
      <DhbPageSyncButton scope="SHIPMENT" label="发货" @completed="loadRows" @repaired="loadRows" />
      <div>
        <div class="list-heading-title">
          <SupplyPageTitle>发货单</SupplyPageTitle>
          <SupplyPageHelp>查看销售订单对应的客户发货、物流单号和发货商品明细。</SupplyPageHelp>
        </div>
      </div>
    </div>

    <OrderRegisterFilterCard
      class="order-register-filter--compact"
      :loading="loading"
      @search="searchRows"
      @reset="resetFilters"
    >
      <template #primary>
        <div class="list-filter-field list-filter-field--text">
          <el-input
            v-model="filters.shipmentNo"
            aria-label="发货单号"
            placeholder="发货单号"
            clearable
            @keyup.enter="searchRows"
          />
        </div>
        <div class="list-filter-field list-filter-field--text">
          <el-input
            v-model="filters.salesOrderNo"
            aria-label="销售订单号"
            placeholder="销售订单号"
            clearable
            @keyup.enter="searchRows"
          />
        </div>
        <div class="list-filter-field list-filter-field--text">
          <el-input
            v-model="filters.customerName"
            aria-label="客户名称"
            placeholder="客户名称"
            clearable
            @keyup.enter="searchRows"
          />
        </div>
        <div class="list-filter-field list-filter-field--text">
          <el-input
            v-model="filters.trackingNo"
            aria-label="快递单号"
            placeholder="快递单号"
            clearable
            @keyup.enter="searchRows"
          />
        </div>
        <div class="list-filter-field list-filter-field--select">
          <el-select
            v-model="filters.shipmentStatusCode"
            aria-label="发货状态"
            placeholder="发货状态"
            clearable
            ><el-option
              v-for="item in shipmentStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
          /></el-select>
        </div>
      </template>
    </OrderRegisterFilterCard>

    <div class="result-heading">
      <div class="result-title-line">
        <h2>发货单列表</h2>
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
          <el-table-column
            prop="shipmentNo"
            label="发货单号"
            width="190"
            fixed="left"
            show-overflow-tooltip
          >
            <template #default="scope">{{
              scope.row.sourceDocumentNo || scope.row.shipmentNo || '-'
            }}</template>
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
          <!-- @vue-generic {SalesShipmentSummary} -->
          <el-table-column prop="shipmentStatusCode" label="发货状态" width="120">
            <template #default="scope">
              <el-tag :type="shipmentStatusTag(scope.row.shipmentStatusCode)" effect="light">
                {{ shipmentStatusLabel(scope.row.shipmentStatusCode, isExternalSource(scope.row)) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="logisticsCompany"
            label="物流/配送方"
            min-width="150"
            show-overflow-tooltip
          >
            <template #default="scope">{{ scope.row.logisticsCompany || '-' }}</template>
          </el-table-column>
          <el-table-column prop="trackingNo" label="物流单号" min-width="170" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.trackingNo || '-' }}</template>
          </el-table-column>
          <el-table-column prop="totalQuantity" label="发货数量" width="120" align="right">
            <template #default="scope">{{ formatNumber(scope.row.totalQuantity) }}</template>
          </el-table-column>
          <el-table-column
            prop="sourceWarehouseName"
            label="发货仓库"
            width="130"
            show-overflow-tooltip
            ><template #default="scope">{{
              scope.row.sourceWarehouseName || '-'
            }}</template></el-table-column
          >
          <el-table-column prop="stockOutTime" label="出库时间" width="190"
            ><template #default="scope">{{
              formatTime(scope.row.stockOutTime)
            }}</template></el-table-column
          >
          <el-table-column prop="shipTime" label="发货时间" width="190">
            <template #default="scope">{{ formatTime(scope.row.shipTime) }}</template>
          </el-table-column>
          <!-- @vue-generic {SalesShipmentSummary} -->
          <el-table-column label="操作" width="150" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
              <el-button
                v-if="!isExternalSource(scope.row) && can('order:shipment:delete', 'order:write')"
                link
                type="danger"
                @click.stop="deleteRow(scope.row)"
                >删除</el-button
              >
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无发货单" /></template>
        </el-table>
      </div>
      <ListTableFooter
        ><CompactPagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="pageData.total"
          @current-change="loadRows"
          @size-change="handleSizeChange"
      /></ListTableFooter>
    </el-card>

    <el-drawer
      v-model="detailVisible"
      class="sales-shipment-detail-drawer"
      size="min(920px, 94vw)"
      :with-header="false"
    >
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>发货单详情</span>
            <h2>{{ detail.sourceDocumentNo || detail.shipmentNo }}</h2>
            <p>
              {{ detail.salesOrderNoSnapshot || '-' }} ·
              {{ shipmentStatusLabel(detail.shipmentStatusCode, isExternalSource(detail)) }}
            </p>
          </div>
          <el-button circle plain aria-label="关闭发货单详情" @click="detailVisible = false"
            >×</el-button
          >
        </header>
        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="发货单号">{{
              detail.sourceDocumentNo || detail.shipmentNo
            }}</el-descriptions-item>
            <el-descriptions-item label="销售订单号">{{
              detail.salesOrderNoSnapshot || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="客户名称">{{
              detail.customerNameSnapshot || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{
              detail.contactPhoneSnapshot || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="发货状态">{{
              shipmentStatusLabel(detail.shipmentStatusCode, isExternalSource(detail))
            }}</el-descriptions-item>
            <el-descriptions-item label="发货数量">{{
              formatNumber(detail.totalQuantity)
            }}</el-descriptions-item>
            <el-descriptions-item label="物流/配送方">{{
              detail.logisticsCompany || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="物流单号">{{
              detail.trackingNo || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="ERP出库单号">{{
              detail.stockOutNo || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="发货仓库">{{
              detail.sourceWarehouseName || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="出库时间">{{
              formatTime(detail.stockOutTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="发货时间">{{
              formatTime(detail.shipTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{
              detail.remark || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="创建人">{{
              auditActorLabel(detail.createdBy)
            }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{
              formatTime(detail.createdTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="更新人">{{
              auditActorLabel(detail.updatedBy)
            }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{
              formatTime(detail.updatedTime)
            }}</el-descriptions-item>
          </el-descriptions>

          <section class="detail-section">
            <h3>发货商品</h3>
            <el-table class="business-table" :data="detail.lines" row-key="id">
              <el-table-column prop="lineNo" label="行号" width="80" />
              <el-table-column
                prop="productCodeSnapshot"
                label="商品编码"
                width="150"
                show-overflow-tooltip
              />
              <el-table-column
                prop="productNameSnapshot"
                label="商品名称"
                min-width="220"
                show-overflow-tooltip
              />
              <el-table-column
                prop="specificationSnapshot"
                label="规格"
                min-width="180"
                show-overflow-tooltip
              />
              <el-table-column label="单位" width="100">
                <template #default="scope">{{ unitLabel(scope.row.unitCode) }}</template>
              </el-table-column>
              <el-table-column prop="shippedQuantity" label="发货数量" width="120" align="right">
                <template #default="scope">{{ formatNumber(scope.row.shippedQuantity) }}</template>
              </el-table-column>
            </el-table>
          </section>
        </div>
      </div>
      <el-skeleton v-else :rows="10" animated />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import SupplyPageHelp from '@/components/supply/SupplyPageHelp.vue'
import { displayDateTime } from '@/utils/business-date'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import DhbPageSyncButton from '@/components/supply/DhbPageSyncButton.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
const { can } = useSupplyPermissions()
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteSalesShipment,
  getSalesShipment,
  getSalesShipments,
  type OrderPage,
  type SalesShipmentDetail,
  type SalesShipmentSummary,
} from '@/api/core/order-sales'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'
import { auditActorLabel } from '@/utils/audit-actor'

const shipmentStatusOptions = computed(() =>
  businessDictionaryOptions('ORDER', 'SALES_SHIPMENT_STATUS'),
)

function searchRows() {
  currentPage.value = 1
  void loadRows()
}
const loading = ref(false)
const detailVisible = ref(false)
const detail = ref<SalesShipmentDetail | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<OrderPage<SalesShipmentSummary>>({ total: 0, begin: 0, step: 20, items: [] })

const filters = reactive({
  shipmentNo: '',
  salesOrderNo: '',
  customerName: '',
  trackingNo: '',
  shipmentStatusCode: '',
})

onMounted(() => {
  void loadBusinessDictionaries([
    { moduleCode: 'ORDER', code: 'SALES_SHIPMENT_STATUS' },
    { moduleCode: 'ORDER', code: 'DHB_SHIPMENT_STATUS' },
    { moduleCode: 'COMMON', code: 'PRODUCT_UNIT' },
  ])
  void loadRows()
})

async function loadRows() {
  loading.value = true
  try {
    pageData.value = await getSalesShipments({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      shipmentNo: empty(filters.shipmentNo),
      salesOrderNo: empty(filters.salesOrderNo),
      customerName: empty(filters.customerName),
      trackingNo: empty(filters.trackingNo),
      shipmentStatusCode: empty(filters.shipmentStatusCode),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '发货单列表加载失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.shipmentNo = ''
  filters.salesOrderNo = ''
  filters.customerName = ''
  filters.trackingNo = ''
  filters.shipmentStatusCode = ''
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

async function openDetail(row: SalesShipmentSummary) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getSalesShipment(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '发货单详情加载失败'))
  }
}

async function deleteRow(row: SalesShipmentSummary) {
  if (isExternalSource(row)) {
    ElMessage.warning('外部来源发货单仅支持查看')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除发货单「${row.shipmentNo}」？后端会做逻辑删除，不会物理清库。`,
      '删除发货单',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await deleteSalesShipment(row.id, row.revision)
    ElMessage.success('发货单已删除')
    await loadRows()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(errorMessage(reason, '发货单删除失败'))
  }
}

function isExternalSource(row: { sourceSystemCode?: string | null }) {
  return Boolean(row.sourceSystemCode && row.sourceSystemCode.trim())
}

function shipmentStatusLabel(value: string | null | undefined, external = false) {
  if (external) {
    const source = (
      {
        CREATED: 'shipped',
        SHIPPED: 'receivedin',
        SIGNED: 'received',
        CANCELLED: 'cancelled',
      } as Record<string, string>
    )[value || '']
    return source
      ? businessDictionaryLabel('ORDER', 'DHB_SHIPMENT_STATUS', source, '发货状态')
      : '-'
  }
  return businessDictionaryLabel('ORDER', 'SALES_SHIPMENT_STATUS', value, '发货状态')
}

function shipmentStatusTag(value: string | null | undefined) {
  if (value === 'SHIPPED' || value === 'SIGNED') return 'success'
  if (value === 'CANCELLED') return 'info'
  return 'warning'
}

function unitLabel(value: string | null | undefined) {
  return businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', value, '单位')
}

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

function formatNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0)
  if (Number.isNaN(number)) return value || '-'
  return number.toLocaleString('zh-CN', { maximumFractionDigits: 6 })
}

const formatTime = displayDateTime

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}
</script>

<style scoped lang="scss">
.sales-shipment-page {
  min-height: 0;
}
</style>
