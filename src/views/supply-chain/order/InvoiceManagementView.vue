<template>
  <div class="order-register-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">订单管理 · 发票管理</span>
        <SupplyPageTitle>发票管理</SupplyPageTitle>
        <p>集中处理订单开票：申请、上传发票附件并完成开票；发票只按内部订单登记，不参与订货宝同步。</p>
      </div>
    </div>

    <OrderRegisterFilterCard :loading="loading" @search="search" @reset="resetFilters">
      <template #primary>
        <el-radio-group v-model="filters.status" @change="search">
          <el-radio-button :value="''">全部 {{ totalCount }}</el-radio-button>
          <el-radio-button value="PENDING">待开票 {{ statusCounts.PENDING || 0 }}</el-radio-button>
          <el-radio-button value="INVOICED">已开票 {{ statusCounts.INVOICED || 0 }}</el-radio-button>
          <el-radio-button value="REVOKED">已撤回 {{ statusCounts.REVOKED || 0 }}</el-radio-button>
        </el-radio-group>
        <el-input
          v-model="filters.orderNo"
          aria-label="订单号"
          clearable
          placeholder="订单号"
          style="width: 170px"
          @keyup.enter="search"
        />
        <el-input
          v-model="filters.customerName"
          aria-label="客户名称"
          clearable
          placeholder="客户名称"
          style="width: 180px"
          @keyup.enter="search"
        />
      </template>
      <template #extra>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="申请开始日期"
          end-placeholder="申请结束日期"
          value-format="YYYY-MM-DD"
          style="width: 260px"
        />
      </template>
    </OrderRegisterFilterCard>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          class="business-table supply-scroll-table"
          height="100%"
          v-loading="loading"
          :data="rows"
          row-key="id"
        >
          <template #empty>
            <div v-if="loadFailed" class="order-load-failed">
              <span>发票列表加载失败，当前没有可展示的数据。</span>
              <el-button link type="primary" @click="loadPage">重新加载</el-button>
            </div>
            <span v-else>暂无数据</span>
          </template>
          <el-table-column type="index" label="序号" width="70" fixed="left" />
          <el-table-column label="订单号" width="170" fixed="left">
            <template #default="{ row }">
              <el-link type="primary" underline="never" @click.stop="openDetail(row)">
                {{ row.orderNo || '-' }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column label="客户名称" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.customerName || '-' }}</template>
          </el-table-column>
          <el-table-column label="发票抬头" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.title || '-' }}</template>
          </el-table-column>
          <el-table-column label="票种" width="100">
            <template #default="{ row }">{{ row.invoiceTypeName || '-' }}</template>
          </el-table-column>
          <el-table-column label="开票金额" width="120" align="right">
            <template #default="{ row }">{{ moneyText(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="发票状态" width="100">
            <template #default="{ row }">
              <el-tag :type="orderInvoiceStatusTag(row.statusCode)" effect="plain" size="small">
                {{ row.statusName || '未申请' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="申请人" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.appliedBy || '-' }}</template>
          </el-table-column>
          <el-table-column label="申请时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.appliedAt) }}</template>
          </el-table-column>
          <el-table-column label="发票号码" width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.invoiceNo || '-' }}</template>
          </el-table-column>
          <el-table-column label="开票日期" width="120">
            <template #default="{ row }">{{ row.invoicedAt ? displayDateTime(row.invoicedAt).slice(0, 10) : '-' }}</template>
          </el-table-column>
          <el-table-column label="附件" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.attachmentCount">{{ row.attachmentCount }} 张</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.statusCode === 'PENDING' && canWrite"
                size="small"
                type="primary"
                @click="openDetail(row)"
              >
                办理
              </el-button>
              <el-button v-else size="small" type="info" @click="openDetail(row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="onPageSizeChange"
          @current-change="loadPage"
        />
      </div>
    </el-card>

    <OrderRegisterDetailDrawer
      v-model="detailVisible"
      :order-id="detailOrderId"
      initial-tab="invoice"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import OrderRegisterDetailDrawer from './components/OrderRegisterDetailDrawer.vue'
import { displayDateTime } from '@/utils/business-date'
import { moneyText } from '@/utils/order-register-status'
import { orderInvoiceStatusTag } from '@/utils/order-invoice-status'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  getOrderInvoicePage,
  type OrderInvoiceListItem,
  type OrderInvoicePageQuery,
} from '@/api/core/order-register'

const { can } = useSupplyPermissions()
const canWrite = computed(() => can('order:invoice:write'))
const route = useRoute()

const loading = ref(false)
const loadFailed = ref(false)
const rows = ref<OrderInvoiceListItem[]>([])
const total = ref(0)
const statusCounts = ref<Record<string, number>>({})
const totalCount = computed(
  () =>
    (statusCounts.value.PENDING || 0) +
    (statusCounts.value.INVOICED || 0) +
    (statusCounts.value.REVOKED || 0),
)

const currentPage = ref(1)
const pageSize = ref(20)
// 订单列表点"发票"直达时带上订单号，进入即按该订单过滤。
const filters = reactive({
  status: '',
  orderNo: String(route.query.orderNo ?? ''),
  customerName: '',
})
const dateRange = ref<[string, string] | null>(null)

const detailVisible = ref(false)
const detailOrderId = ref<string | number | null>(null)

function openDetail(row: { orderId?: string | number }) {
  detailOrderId.value = row.orderId ?? null
  detailVisible.value = true
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}

function appliedRange(): Pick<OrderInvoicePageQuery, 'appliedFrom' | 'appliedTo'> {
  const range = dateRange.value
  if (!range || !range[0] || !range[1]) return {}
  return {
    appliedFrom: new Date(`${range[0]}T00:00:00+08:00`).toISOString(),
    appliedTo: new Date(`${range[1]}T23:59:59.999+08:00`).toISOString(),
  }
}

async function loadPage() {
  loading.value = true
  loadFailed.value = false
  try {
    const view = await getOrderInvoicePage({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      status: filters.status || undefined,
      orderNo: filters.orderNo.trim() || undefined,
      customerName: filters.customerName.trim() || undefined,
      ...appliedRange(),
    })
    rows.value = view.page.items
    total.value = view.page.total
    statusCounts.value = view.statusCounts || {}
  } catch (reason) {
    loadFailed.value = true
    ElMessage.error(errorMessage(reason, '发票列表加载失败，请稍后重试'))
  } finally {
    loading.value = false
  }
}

function search() {
  currentPage.value = 1
  void loadPage()
}

function resetFilters() {
  filters.status = ''
  filters.orderNo = ''
  filters.customerName = ''
  dateRange.value = null
  search()
}

function onPageSizeChange() {
  currentPage.value = 1
  void loadPage()
}

onMounted(loadPage)
</script>

<style scoped>
.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}
.table-viewport {
  min-height: 320px;
}
.order-load-failed {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}
</style>
