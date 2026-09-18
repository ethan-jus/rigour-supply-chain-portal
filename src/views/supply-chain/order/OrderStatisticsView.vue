<template>
  <div class="order-register-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">订单管理 · 订单与回款统计</span>
        <SupplyPageTitle>订单与回款统计</SupplyPageTitle>
        <p>期间发生额与截至日余额分开统计；期末未回款从订单侧重建，不遗漏无收款订单。</p>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="order-statistics-tabs">
      <el-tab-pane label="期间经营" name="period">
        <el-card class="filter-card" shadow="never">
          <div class="statistics-filter">
            <el-date-picker
              v-model="periodFilters.range"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              aria-label="统计期间"
              style="width: 250px"
            />
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
            <el-input v-model="filters.customerName" aria-label="客户名称" clearable placeholder="客户名称" style="width: 170px" @keyup.enter="loadPeriod" />
            <el-input v-model="filters.customerCode" aria-label="客户编码" clearable placeholder="客户编码" style="width: 150px" @keyup.enter="loadPeriod" />
            <el-select v-model="periodFilters.groupBy" aria-label="汇总维度" placeholder="汇总维度" style="width: 130px">
              <el-option label="按地区" value="region" />
              <el-option label="按客户" value="customer" />
              <el-option label="按业务员" value="employee" />
            </el-select>
            <el-button type="primary" :loading="periodLoading" @click="loadPeriod">查询</el-button>
            <el-button @click="resetPeriod">重置</el-button>
            <el-button :loading="periodExporting" @click="exportPeriod">导出</el-button>
          </div>
        </el-card>

        <el-alert
          v-if="coverageNotice(periodView?.coverage)"
          :title="coverageNotice(periodView?.coverage)"
          type="warning"
          :closable="false"
          class="order-register-coverage"
        />

        <div class="statistics-metrics">
          <div v-for="metric in periodMetrics" :key="metric.label" class="statistics-metric">
            <span>{{ metric.label }}</span>
            <strong>{{ moneyText(metric.value) }}</strong>
            <small>{{ metric.hint }}</small>
          </div>
        </div>

        <el-card class="list-card" shadow="never">
          <el-table
            v-loading="periodLoading"
            :data="periodView?.rows || []"
            class="business-table"
            @row-click="drillPeriod"
          >
            <el-table-column prop="label" :label="groupByLabel" min-width="180" />
            <el-table-column label="期间订单额" width="140" align="right">
              <template #default="{ row }">{{ moneyText(row.periodOrderAmount) }}</template>
            </el-table-column>
            <el-table-column label="期间实收" width="140" align="right">
              <template #default="{ row }">{{ moneyText(row.periodReceivedAmount) }}</template>
            </el-table-column>
            <el-table-column label="期间退款/冲销" width="150" align="right">
              <template #default="{ row }">{{ moneyText(row.periodRefundAmount) }}</template>
            </el-table-column>
            <el-table-column label="期间净回款" width="140" align="right">
              <template #default="{ row }">{{ moneyText(row.periodNetReceivedAmount) }}</template>
            </el-table-column>
            <el-table-column label="期末未回款" width="140" align="right">
              <template #default="{ row }"><strong>{{ moneyText(row.endingUnpaidAmount) }}</strong></template>
            </el-table-column>
            <template #empty>选择统计期间后查询；点击汇总行下钻到订单列表。</template>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="截至日未回款" name="receivables">
        <el-card class="filter-card" shadow="never">
          <div class="statistics-filter">
            <el-date-picker
              v-model="receivablesFilters.asOfDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="截止日期"
              aria-label="截止日期"
              style="width: 150px"
            />
            <el-select v-model="receivablesFilters.hasUnpaid" aria-label="未回款范围" style="width: 140px">
              <el-option label="仅未回款" value="true" />
              <el-option label="全部订单" value="false" />
            </el-select>
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
            <el-input v-model="filters.customerName" aria-label="客户名称" clearable placeholder="客户名称" style="width: 170px" @keyup.enter="loadReceivables" />
            <el-input v-model="filters.customerCode" aria-label="客户编码" clearable placeholder="客户编码" style="width: 150px" @keyup.enter="loadReceivables" />
            <el-date-picker
              v-model="receivablesFilters.orderDateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="下单开始日期"
              end-placeholder="下单截止日期"
              aria-label="订单批次下单时间"
              style="width: 250px"
            />
            <el-button type="primary" :loading="receivablesLoading" @click="loadReceivables">查询</el-button>
            <el-button @click="resetReceivables">重置</el-button>
            <el-button :loading="receivablesExporting" @click="exportReceivables">导出</el-button>
          </div>
        </el-card>

        <el-alert
          v-if="coverageNotice(receivablesView?.coverage)"
          :title="coverageNotice(receivablesView?.coverage)"
          type="warning"
          :closable="false"
          class="order-register-coverage"
        />
        <el-alert
          v-if="receivablesFilters.orderDateRange"
          title="已选择下单时间区间，当前为“所选订单截至该日未回款”，不再包含区间外的历史订单。"
          type="info"
          :closable="false"
          class="order-register-coverage"
        />

        <div class="result-heading">
          <div class="result-title-line">
            <h2>截至 {{ receivablesFilters.asOfDate }} 未回款</h2>
            <span class="result-count"><strong>{{ receivablesView?.items.length || 0 }}</strong> 条</span>
          </div>
          <div class="result-totals">
            <span>有效应收 <strong>{{ totalsText(receivablesView?.totals.receivableAmount) }}</strong></span>
            <span>累计净回款 <strong>{{ totalsText(receivablesView?.totals.netReceivedAmount) }}</strong></span>
            <span>未回款 <strong>{{ totalsText(receivablesView?.totals.unpaidAmount) }}</strong></span>
            <span>溢收/待退 <strong>{{ totalsText(receivablesView?.totals.overpaidAmount) }}</strong></span>
          </div>
        </div>

        <el-card class="list-card" shadow="never">
          <el-table
            v-loading="receivablesLoading"
            :data="receivablesView?.items || []"
            class="business-table"
            row-key="orderId"
            @row-click="drillReceivables"
          >
            <el-table-column label="订单号" width="160">
              <template #default="{ row }">
                <el-link type="primary" underline="never" @click.stop="openOrder(row)">
                  <span class="order-no-cell">{{ row.orderNo }}</span>
                </el-link>
              </template>
            </el-table-column>
            <el-table-column prop="customerName" label="客户" min-width="180" show-overflow-tooltip />
            <el-table-column label="归属地区" width="130">
              <template #default="{ row }">{{ areaLabel(row.regionCode, row.regionName) }}</template>
            </el-table-column>
            <el-table-column label="业务员" width="120">
              <template #default="{ row }">{{ employeeLabel(row.ownerEmployeeCode, row.ownerEmployeeName) }}</template>
            </el-table-column>
            <el-table-column label="下单时间" width="170">
              <template #default="{ row }">{{ displayDateTime(row.orderDate) }}</template>
            </el-table-column>
            <el-table-column label="截至日有效应收" width="150" align="right">
              <template #default="{ row }">{{ totalsText(row.receivableAmount) }}</template>
            </el-table-column>
            <el-table-column label="截至日累计净回款" width="170" align="right">
              <template #default="{ row }">{{ totalsText(row.netReceivedAmount) }}</template>
            </el-table-column>
            <el-table-column label="截至日未回款" width="150" align="right">
              <template #default="{ row }"><strong>{{ totalsText(row.unpaidAmount) }}</strong></template>
            </el-table-column>
            <el-table-column label="溢收/待退" width="130" align="right">
              <template #default="{ row }">{{ totalsText(row.overpaidAmount) }}</template>
            </el-table-column>
            <el-table-column label="历史完整" width="110">
              <template #default="{ row }">
                <el-tag :type="row.historyComplete ? 'success' : 'warning'" effect="plain" size="small">
                  {{ row.historyComplete === null ? '未知' : row.historyComplete ? '完整' : '不完整' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="覆盖起始" width="120">
              <template #default="{ row }">{{ row.coverageFrom || '-' }}</template>
            </el-table-column>
            <template #empty>选择截止日期后查询。</template>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <OrderRegisterDetailDrawer v-model="detailVisible" :order-id="detailOrderId" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import OrderRegisterDetailDrawer from './components/OrderRegisterDetailDrawer.vue'
import { businessDate, displayDateTime } from '@/utils/business-date'
import { moneyText, totalsText } from '@/utils/order-register-status'
import { empty, orderRegisterDateParams } from '@/utils/order-register-query'
import { csvFilename, downloadBlob } from '@/utils/file-download'
import {
  exportOrderRegisterCsv,
  getOrderRegisterPeriod,
  getOrderRegisterReceivables,
  type OrderPeriodView,
  type OrderReceivablesView,
  type OrderRegisterCoverage,
} from '@/api/core/order-register'
import { useOrderRegisterCommonFilters } from '@/composables/useOrderRegisterQuery'
import { useOrderRegisterOptions } from '@/composables/useOrderRegisterOptions'

const router = useRouter()
const {
  areaTree,
  departmentOptionsTree,
  employeeOptions,
  employeeLoading,
  areaTreeProps,
  departmentTreeProps,
  loadOptions,
  searchEmployees,
  areaLabel,
  employeeLabel,
} = useOrderRegisterOptions()
const { filters, resetCommonFilters } = useOrderRegisterCommonFilters()

const activeTab = ref('period')
const periodFilters = reactive({
  range: null as [string, string] | null,
  groupBy: 'region' as 'region' | 'customer' | 'employee',
})
const receivablesFilters = reactive({
  asOfDate: businessDate(new Date()),
  hasUnpaid: 'true',
  orderDateRange: null as [string, string] | null,
})

const periodLoading = ref(false)
const periodExporting = ref(false)
const receivablesLoading = ref(false)
const receivablesExporting = ref(false)
const periodView = ref<OrderPeriodView | null>(null)
const receivablesView = ref<OrderReceivablesView | null>(null)

const detailVisible = ref(false)
const detailOrderId = ref<string | number | null>(null)

const groupByLabel = computed(() => {
  if (periodFilters.groupBy === 'customer') return '客户'
  if (periodFilters.groupBy === 'employee') return '业务员'
  return '归属地区'
})

const periodMetrics = computed(() => {
  const totals = periodView.value?.totals
  return [
    { label: '期间订单额', value: totals?.periodOrderAmount ?? null, hint: '按下单时间计入本期间' },
    { label: '期间实收金额', value: totals?.periodReceivedAmount ?? null, hint: '按实际到账时间计入' },
    { label: '期间退款/冲销', value: totals?.periodRefundAmount ?? null, hint: '按退款生效时间计入' },
    { label: '期间净回款', value: totals?.periodNetReceivedAmount ?? null, hint: '实收扣除退款冲销' },
    { label: '期末未回款', value: totals?.endingUnpaidAmount ?? null, hint: '截至期间结束日，含往期订单' },
  ]
})

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}

function coverageNotice(coverage: OrderRegisterCoverage | null | undefined): string {
  if (!coverage) return ''
  if (coverage.message) return coverage.message
  if (coverage.historyComplete === false) {
    return coverage.coverageFrom
      ? `历史数据仅可从 ${coverage.coverageFrom} 起准确回溯，此前范围不完整。`
      : '历史数据覆盖不完整，统计金额不能视为已确认。'
  }
  return ''
}

function periodRequirement(): string {
  if (!periodFilters.range?.[0] || !periodFilters.range?.[1]) return '请选择统计期间'
  return ''
}

function receivablesRequirement(): string {
  if (!receivablesFilters.asOfDate) return '请选择截止日期'
  return ''
}

function commonAttributionParams() {
  return {
    customerName: empty(filters.customerName),
    customerCode: empty(filters.customerCode),
    regionCode: empty(filters.regionCode),
    ownerEmployeeCode: empty(filters.ownerEmployeeCode),
    departmentId: filters.departmentId ?? undefined,
  }
}

async function loadPeriod() {
  const requirement = periodRequirement()
  if (requirement) {
    ElMessage.warning(requirement)
    return
  }
  periodLoading.value = true
  try {
    periodView.value = await getOrderRegisterPeriod({
      dateFrom: periodFilters.range![0],
      dateTo: periodFilters.range![1],
      groupBy: periodFilters.groupBy,
      ...commonAttributionParams(),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '期间经营统计加载失败，请稍后重试'))
  } finally {
    periodLoading.value = false
  }
}

async function loadReceivables() {
  const requirement = receivablesRequirement()
  if (requirement) {
    ElMessage.warning(requirement)
    return
  }
  receivablesLoading.value = true
  try {
    const orderDate = orderRegisterDateParams(receivablesFilters.orderDateRange)
    receivablesView.value = await getOrderRegisterReceivables({
      asOfDate: receivablesFilters.asOfDate,
      hasUnpaid: receivablesFilters.hasUnpaid === 'true',
      ...commonAttributionParams(),
      ...orderDate,
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '截至日未回款加载失败，请稍后重试'))
  } finally {
    receivablesLoading.value = false
  }
}

function resetPeriod() {
  resetCommonFilters()
  periodFilters.range = null
  periodFilters.groupBy = 'region'
  periodView.value = null
}

function resetReceivables() {
  resetCommonFilters()
  receivablesFilters.asOfDate = businessDate(new Date())
  receivablesFilters.hasUnpaid = 'true'
  receivablesFilters.orderDateRange = null
  receivablesView.value = null
}

function drillPeriod(row: { key: string; label: string }) {
  if (!periodFilters.range) return
  const query: Record<string, string> = {
    orderDateFrom: periodFilters.range[0],
    orderDateTo: periodFilters.range[1],
  }
  if (periodFilters.groupBy === 'region') query.regionCode = row.key
  else if (periodFilters.groupBy === 'employee') query.ownerEmployeeCode = row.key
  else query.customerName = row.key
  void router.push({ path: '/supply-chain/order/sales-orders', query })
}

function drillReceivables(row: { orderNo?: string }) {
  if (row.orderNo) {
    void router.push({ path: '/supply-chain/order/sales-orders', query: { orderNo: row.orderNo } })
  }
}

function openOrder(row: { orderId?: string }) {
  detailOrderId.value = row.orderId ?? null
  detailVisible.value = true
}

async function exportPeriod() {
  const requirement = periodRequirement()
  if (requirement) {
    ElMessage.warning(requirement)
    return
  }
  periodExporting.value = true
  try {
    const blob = await exportOrderRegisterCsv('period', {
      dateFrom: periodFilters.range![0],
      dateTo: periodFilters.range![1],
      groupBy: periodFilters.groupBy,
      ...commonAttributionParams(),
    })
    downloadBlob(blob, csvFilename('期间经营统计'))
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '导出失败，请稍后重试'))
  } finally {
    periodExporting.value = false
  }
}

async function exportReceivables() {
  const requirement = receivablesRequirement()
  if (requirement) {
    ElMessage.warning(requirement)
    return
  }
  receivablesExporting.value = true
  try {
    const orderDate = orderRegisterDateParams(receivablesFilters.orderDateRange)
    const blob = await exportOrderRegisterCsv('receivables', {
      asOfDate: receivablesFilters.asOfDate,
      hasUnpaid: receivablesFilters.hasUnpaid === 'true',
      ...commonAttributionParams(),
      ...orderDate,
    })
    downloadBlob(blob, csvFilename('截至日未回款'))
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '导出失败，请稍后重试'))
  } finally {
    receivablesExporting.value = false
  }
}

onMounted(() => {
  void loadOptions()
})

defineExpose({
  activeTab,
  periodFilters,
  receivablesFilters,
  periodView,
  receivablesView,
  loadPeriod,
  loadReceivables,
  resetPeriod,
  resetReceivables,
})
</script>

<style scoped>
.order-register-page {
  min-height: 0;
}
.order-statistics-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.order-statistics-tabs :deep(.el-tabs__content) {
  overflow: auto;
}
.statistics-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.order-register-coverage {
  margin-bottom: 12px;
}
.statistics-metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin: 12px 0;
}
.statistics-metric {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--supply-radius, 8px);
  background: var(--supply-surface, #fff);
}
.statistics-metric span {
  display: block;
  color: var(--el-text-color-regular);
}
.statistics-metric strong {
  display: block;
  margin: 6px 0;
  font-size: 22px;
}
.statistics-metric small {
  color: var(--el-text-color-secondary);
}
.result-totals {
  display: flex;
  gap: 18px;
  color: var(--el-text-color-regular);
  flex-wrap: wrap;
}
.result-totals strong {
  color: var(--el-text-color-primary);
}
.order-no-cell {
  font-weight: 600;
}
@media (max-width: 1100px) {
  .statistics-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
