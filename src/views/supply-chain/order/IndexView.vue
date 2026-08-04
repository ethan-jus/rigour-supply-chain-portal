<template>
  <div class="dhb-order-page">
    <template v-if="isOrderQueryPage">
      <div class="page-heading">
        <div>
          <h1>{{ pageTitle }}</h1>
          <p>查询订单中心的本地投影；订货宝认证、分页和同步由 Integration 统一负责。</p>
        </div>
        <el-tag type="info" effect="plain">只读查询</el-tag>
      </div>

      <el-card class="filter-card" shadow="never">
        <el-form :model="filters" inline @submit.prevent="handleQuery">
          <el-form-item label="订单状态">
            <el-select v-model="filters.orderStatus" clearable placeholder="全部状态" style="width: 180px">
              <el-option v-for="item in orderStatuses" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="开始日期">
            <el-date-picker v-model="filters.startDate" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" />
          </el-form-item>
          <el-form-item label="截止日期">
            <el-date-picker v-model="filters.endDate" type="date" value-format="YYYY-MM-DD" placeholder="截止日期" />
          </el-form-item>
          <el-form-item label="收款状态">
            <el-select v-model="filters.payStatus" clearable placeholder="全部状态" style="width: 150px">
              <el-option v-for="item in payStatuses" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="接口状态">
            <el-select v-model="filters.apiStatus" style="width: 130px">
              <el-option label="未下载" value="F" />
              <el-option label="已下载" value="T" />
              <el-option label="全部" value="all" />
            </el-select>
          </el-form-item>
          <el-form-item class="filter-actions">
            <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-alert
        v-if="requestError"
        class="request-error"
        type="error"
        :closable="false"
        show-icon
        :title="requestError"
      />

      <div class="summary-bar">
        <span>本地订单 <strong>{{ pageData.total }}</strong> 条</span>
        <span class="summary-note">同步任务由 Integration 负责</span>
      </div>

      <el-card shadow="never">
        <el-table v-loading="loading" :data="pageData.items" row-key="orderSn" @row-click="openDetail">
          <el-table-column prop="orderSn" label="订单编号" min-width="190" fixed="left" />
          <el-table-column label="下单时间" min-width="165">
            <template #default="scope">{{ formatTime(scope.row.orderDate) }}</template>
          </el-table-column>
          <el-table-column prop="clientName" label="客户名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="receiveCompany" label="收货单位" min-width="150" show-overflow-tooltip />
          <el-table-column prop="receiveName" label="收货人" width="110" />
          <el-table-column prop="receivePhone" label="联系电话" width="140" />
          <el-table-column label="订单金额" width="120" align="right">
            <template #default="scope">{{ formatMoney(scope.row.orderTotal) }}</template>
          </el-table-column>
          <el-table-column label="订单状态" width="110">
            <template #default="scope">{{ formatStatus(scope.row.orderStatus) }}</template>
          </el-table-column>
          <el-table-column label="收款状态" width="110">
            <template #default="scope">{{ formatPayStatus(scope.row.payStatus) }}</template>
          </el-table-column>
          <el-table-column label="明细" width="90" fixed="right">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">查看</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无本地订单投影" /></template>
        </el-table>
        <div class="pagination-row">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[20, 50, 100]"
            :total="pageData.total"
            @current-change="loadOrders"
            @size-change="handleSizeChange"
          />
        </div>
      </el-card>

      <el-dialog v-model="detailVisible" title="订单详情" width="920px">
        <el-skeleton v-if="detailLoading" :rows="8" animated />
        <template v-else-if="detail">
          <div class="detail-summary">
            <div><span>订单编号</span><strong>{{ detail.order.orderSn }}</strong></div>
            <div><span>客户名称</span><strong>{{ detail.order.clientName || '-' }}</strong></div>
            <div><span>订单金额</span><strong>{{ formatMoney(detail.order.orderTotal) }}</strong></div>
            <div><span>同步状态</span><strong>{{ detail.synchronizedFromProvider ? '已落库' : '本地投影' }}</strong></div>
          </div>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="下单时间">{{ formatTime(detail.order.orderDate) }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">{{ formatStatus(detail.order.orderStatus) }}</el-descriptions-item>
            <el-descriptions-item label="收款状态">{{ formatPayStatus(detail.order.payStatus) }}</el-descriptions-item>
            <el-descriptions-item label="收货单位">{{ detail.order.receiveCompany || '-' }}</el-descriptions-item>
            <el-descriptions-item label="收货人">{{ detail.order.receiveName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ detail.order.receivePhone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="收货地址" :span="3">{{ detail.order.receiveAddress || '-' }}</el-descriptions-item>
            <el-descriptions-item label="订单备注" :span="3">{{ detail.order.orderRemark || '-' }}</el-descriptions-item>
          </el-descriptions>
          <h3 class="detail-title">商品明细</h3>
          <el-table :data="detail.lines" size="small">
            <el-table-column prop="productName" label="商品名称" min-width="220" />
            <el-table-column prop="skuNo" label="SKU" min-width="150" />
            <el-table-column prop="quantity" label="数量" width="100" />
            <el-table-column prop="unit" label="单位" width="90" />
            <el-table-column label="单价" width="110" align="right">
              <template #default="scope">{{ formatMoney(scope.row.unitPrice) }}</template>
            </el-table-column>
          </el-table>
          <h3 class="detail-title">发货信息</h3>
          <el-table :data="detail.shipments" size="small">
            <el-table-column prop="shipmentNo" label="发货单号" min-width="180" />
            <el-table-column prop="status" label="状态" width="120" />
            <el-table-column prop="shipmentDate" label="发货时间" min-width="180" />
            <el-table-column prop="stockUpTime" label="备货时间" min-width="180" />
          </el-table>
        </template>
        <el-empty v-else description="暂无详情" />
        <template #footer>
          <el-button @click="detailVisible = false">关闭</el-button>
        </template>
      </el-dialog>
    </template>

    <el-card v-else shadow="never" class="placeholder-card">
      <template #header><strong>{{ pageTitle }}</strong></template>
      <el-empty description="一期先完成订单基础查询；该菜单暂不提供新增、修改等写操作。" />
      <el-alert type="info" :closable="false" show-icon title="后续可在同一订货宝菜单下接入商品、营销、库存、客户、资金、报表、数据和系统模块。" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  getDinghuobaoOrderDetail,
  getDinghuobaoOrders,
  type DhbOrder,
  type DhbOrderDetail,
  type DhbOrderPage,
  type DhbOrderQuery,
} from '@/api'

const route = useRoute()
const pageKey = computed(() => String(route.meta.pageKey || 'order'))
const pageTitle = computed(() => ({
  order: '订单',
  'order-list': '订货单',
  'stock-up': '出库发货',
  shipments: '发货单',
  returns: '退货单',
  'delivery-partners': '配送伙伴',
  'stats-goods': '订单商品统计',
  'stats-pending-stock': '待出库统计',
  'stats-shipped': '已出库统计',
  'stats-pending-delivery': '待发货统计',
  'stats-returns': '退单商品统计',
}[pageKey.value] || String(route.meta.title || '订货宝')))
// “订单”是二级菜单分组；一期只有“订货单”页面提供本地投影查询。
const isOrderQueryPage = computed(() => pageKey.value === 'order-list')

const orderStatuses = [
  { label: '定价中', value: 'pricing' }, { label: '待审核', value: 'pending' },
  { label: '备货中', value: 'stock_up' }, { label: '已发货', value: 'shipped' },
  { label: '已收货', value: 'received' }, { label: '已完成', value: 'finished' },
  { label: '已取消', value: 'cancelled' },
]
const payStatuses = [
  { label: '待收款', value: 'uncollect' }, { label: '已收款', value: 'paided' },
  { label: '已取消', value: 'cancelled' }, { label: '部分收款', value: 'part' },
]
const filters = reactive({ orderStatus: '', startDate: '', endDate: '', payStatus: '', apiStatus: 'all' })
const loading = ref(false)
const requestError = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<DhbOrderPage>({ total: 0, providerTotal: 0, synchronizedCount: 0, items: [] })
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<DhbOrderDetail | null>(null)

function buildQuery(): DhbOrderQuery {
  const query: DhbOrderQuery = {
    begin: (currentPage.value - 1) * pageSize.value,
    step: pageSize.value,
    apiStatus: filters.apiStatus,
    exceptionStatus: 'F',
  }
  if (filters.orderStatus) query.order_status_val = filters.orderStatus
  if (filters.startDate) query.starttime = `${filters.startDate} 00:00:00`
  if (filters.endDate) query.endtime = `${filters.endDate} 23:59:59`
  if (filters.payStatus) query.payStatus = filters.payStatus
  return query
}

async function loadOrders() {
  if (!isOrderQueryPage.value) return
  loading.value = true
  requestError.value = null
  try { pageData.value = await getDinghuobaoOrders(buildQuery()) }
  catch (reason) {
    requestError.value = errorMessage(reason, '订单查询失败')
    ElMessage.error(requestError.value)
  }
  finally { loading.value = false }
}

async function handleQuery() { currentPage.value = 1; await loadOrders() }

async function openDetail(order: DhbOrder) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try { detail.value = await getDinghuobaoOrderDetail(order.orderSn) }
  catch (reason) { ElMessage.error(errorMessage(reason, '订单详情加载失败')) }
  finally { detailLoading.value = false }
}

function handleSizeChange(size: number) { pageSize.value = size; currentPage.value = 1; void loadOrders() }

function resetFilters() {
  Object.assign(filters, { orderStatus: '', startDate: '', endDate: '', payStatus: '', apiStatus: 'all' })
  void handleQuery()
}

function formatTime(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function formatMoney(value: number | null): string { return value == null ? '-' : `¥${Number(value).toFixed(2)}` }

function formatStatus(value: string | null): string {
  return orderStatuses.find((item) => item.value === value)?.label || value || '-'
}

function formatPayStatus(value: string | null): string {
  return payStatuses.find((item) => item.value === value)?.label || value || '-'
}

function errorMessage(reason: unknown, fallback: string): string {
  if (reason && typeof reason === 'object' && 'message' in reason && typeof reason.message === 'string') return reason.message
  return fallback
}

watch(pageKey, () => {
  currentPage.value = 1
  if (isOrderQueryPage.value) void loadOrders()
})
onMounted(() => {
  if (isOrderQueryPage.value) void loadOrders()
})
</script>

<style scoped lang="scss">
.dhb-order-page { min-width: 0; }
.page-heading { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.page-heading h1 { margin: 0 0 8px; color: #172033; font-size: 24px; }
.page-heading p { margin: 0; color: #8a94a6; font-size: 13px; }
.filter-card { margin-bottom: 16px; }
.request-error { margin-bottom: 16px; }
.filter-card :deep(.el-form-item) { margin-bottom: 10px; }
.filter-actions { margin-right: 0; }
.summary-bar { display: flex; align-items: center; gap: 24px; min-height: 48px; color: #6f7b8f; font-size: 13px; }
.summary-bar strong { color: #172033; font-size: 16px; }
.summary-note { margin-left: auto; color: #8a94a6; }
.pagination-row { display: flex; justify-content: flex-end; padding-top: 18px; }
.detail-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; padding: 14px; background: #f7f9fc; border-radius: 6px; }
.detail-summary div { display: flex; flex-direction: column; gap: 6px; }
.detail-summary span { color: #8a94a6; font-size: 12px; }
.detail-summary strong { color: #172033; font-size: 14px; }
.detail-title { margin: 22px 0 10px; color: #172033; font-size: 15px; }
.placeholder-card { min-height: 420px; }
@media (max-width: 1000px) {
  .summary-bar { flex-wrap: wrap; padding: 10px 0; }
  .summary-note { margin-left: 0; }
  .detail-summary { grid-template-columns: repeat(2, 1fr); }
}
</style>
