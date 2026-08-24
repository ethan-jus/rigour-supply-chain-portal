<template>
  <div class="sales-shipment-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">Order · 履约中心</span>
        <h1>发货单</h1>
        <p>查看销售订单对应的客户发货、物流单号和发货商品明细。</p>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="loadRows">
        <el-form-item label="发货单号">
          <el-input v-model="filters.shipmentNo" clearable placeholder="发货单号" style="width: 170px" />
        </el-form-item>
        <el-form-item label="销售订单号">
          <el-input v-model="filters.salesOrderNo" clearable placeholder="销售订单号" style="width: 170px" />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="filters.customerName" clearable placeholder="客户名称" style="width: 200px" />
        </el-form-item>
        <el-form-item label="物流单号">
          <el-input v-model="filters.trackingNo" clearable placeholder="物流/配送单号" style="width: 180px" />
        </el-form-item>
        <el-form-item label="发货状态">
          <el-select v-model="filters.shipmentStatusCode" clearable placeholder="全部状态" style="width: 140px">
            <el-option v-for="item in shipmentStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
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
        <h2>发货单列表</h2>
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
          <el-table-column prop="shipmentNo" label="发货单号" width="170" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.shipmentNo || '-' }}</template>
          </el-table-column>
          <el-table-column prop="salesOrderNoSnapshot" label="销售订单号" width="170" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.salesOrderNoSnapshot || '-' }}</template>
          </el-table-column>
          <el-table-column prop="customerNameSnapshot" label="客户名称" min-width="220" show-overflow-tooltip>
            <template #default="scope">
              <div class="record-identity">
                <span class="record-avatar">发</span>
                <div class="record-identity-content">
                  <strong>{{ scope.row.customerNameSnapshot || '-' }}</strong>
                  <small>{{ scope.row.customerCodeSnapshot || scope.row.contactPhoneSnapshot || '-' }}</small>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="shipmentStatusCode" label="发货状态" width="120">
            <template #default="scope">
              <el-tag :type="shipmentStatusTag(scope.row.shipmentStatusCode)" effect="light">
                {{ shipmentStatusLabel(scope.row.shipmentStatusCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="logisticsCompany" label="物流/配送方" min-width="150" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.logisticsCompany || '-' }}</template>
          </el-table-column>
          <el-table-column prop="trackingNo" label="物流单号" min-width="170" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.trackingNo || '-' }}</template>
          </el-table-column>
          <el-table-column prop="totalQuantity" label="发货数量" width="120" align="right">
            <template #default="scope">{{ formatNumber(scope.row.totalQuantity) }}</template>
          </el-table-column>
          <el-table-column prop="shipTime" label="发货时间" width="180">
            <template #default="scope">{{ formatTime(scope.row.shipTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
              <el-button link type="danger" @click.stop="deleteRow(scope.row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无发货单" /></template>
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

    <el-drawer v-model="detailVisible" class="sales-shipment-detail-drawer" size="min(920px, 94vw)" :with-header="false">
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>发货单详情</span>
            <h2>{{ detail.shipmentNo }}</h2>
            <p>{{ detail.salesOrderNoSnapshot || '-' }} · {{ shipmentStatusLabel(detail.shipmentStatusCode) }}</p>
          </div>
          <el-button circle plain aria-label="关闭发货单详情" @click="detailVisible = false">×</el-button>
        </header>
        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="发货单号">{{ detail.shipmentNo }}</el-descriptions-item>
            <el-descriptions-item label="销售订单号">{{ detail.salesOrderNoSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户名称">{{ detail.customerNameSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ detail.contactPhoneSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="发货状态">{{ shipmentStatusLabel(detail.shipmentStatusCode) }}</el-descriptions-item>
            <el-descriptions-item label="发货数量">{{ formatNumber(detail.totalQuantity) }}</el-descriptions-item>
            <el-descriptions-item label="物流/配送方">{{ detail.logisticsCompany || '-' }}</el-descriptions-item>
            <el-descriptions-item label="物流单号">{{ detail.trackingNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="ERP出库单号">{{ detail.stockOutNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="发货时间">{{ formatTime(detail.shipTime) }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建人">{{ detail.createdBy || '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(detail.createdTime) }}</el-descriptions-item>
            <el-descriptions-item label="更新人">{{ detail.updatedBy || '-' }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(detail.updatedTime) }}</el-descriptions-item>
          </el-descriptions>

          <section class="detail-section">
            <h3>发货商品</h3>
            <el-table class="business-table" :data="detail.lines" row-key="id">
              <el-table-column prop="lineNo" label="行号" width="80" />
              <el-table-column prop="productCodeSnapshot" label="商品编码" width="150" show-overflow-tooltip />
              <el-table-column prop="productNameSnapshot" label="商品名称" min-width="220" show-overflow-tooltip />
              <el-table-column prop="specificationSnapshot" label="规格" min-width="180" show-overflow-tooltip />
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

const shipmentStatusOptions = computed(() => businessDictionaryOptions('ORDER', 'SALES_SHIPMENT_STATUS'))

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
  try {
    await ElMessageBox.confirm(`确认删除发货单「${row.shipmentNo}」？后端会做逻辑删除，不会物理清库。`, '删除发货单', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteSalesShipment(row.id, row.revision)
    ElMessage.success('发货单已删除')
    await loadRows()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(errorMessage(reason, '发货单删除失败'))
  }
}

function shipmentStatusLabel(value: string | null | undefined) {
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

function formatTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

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
