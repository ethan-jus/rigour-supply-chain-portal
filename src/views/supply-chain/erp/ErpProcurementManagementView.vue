<template>
  <ErpListWorkspace title="采购订单列表" :total="total">
    <template #filters>
      <el-form class="purchase-query" :model="filters" label-width="80px" @submit.prevent="search">
        <div class="erp-query-grid">
          <el-form-item label="采购单号"
            ><el-input v-model="filters.procurementNo" clearable placeholder="输入采购单号"
          /></el-form-item>
          <el-form-item label="供应商"
            ><el-select
              v-model="filters.supplierCode"
              clearable
              filterable
              remote
              :remote-method="searchSuppliers"
              :loading="supplierLoading"
              placeholder="全部供应商"
              ><el-option
                v-for="s in suppliers"
                :key="s.supplierCode"
                :label="s.supplierName"
                :value="s.supplierCode" /></el-select
          ></el-form-item>
          <el-form-item label="采购日期"
            ><el-date-picker
              v-model="filters.dates"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="截止日期"
          /></el-form-item>
          <el-form-item label="单据状态"
            ><el-select v-model="filters.confirmationStatusCode" clearable placeholder="全部状态"
              ><el-option label="待确认" value="UNCONFIRMED" /><el-option
                label="已确认"
                value="CONFIRMED" /></el-select
          ></el-form-item>
          <el-form-item label="收货仓库"
            ><el-select
              v-model="filters.targetWarehouseCode"
              clearable
              filterable
              remote
              :remote-method="searchWarehouses"
              :loading="warehouseLoading"
              placeholder="全部仓库"
              ><el-option
                v-for="w in warehouses"
                :key="w.warehouseCode"
                :label="w.warehouseName"
                :value="w.warehouseCode" /></el-select
          ></el-form-item>
          <div class="filter-actions">
            <el-button :icon="Search" type="primary" native-type="submit" :loading="loading"
              >查询</el-button
            >
            <el-button :icon="Refresh" @click="reset">重置</el-button>
          </div>
        </div>
      </el-form>
    </template>
    <template #summary>
      <div class="purchase-totals" :aria-busy="loading" aria-live="polite" aria-label="采购合计">
        <div class="purchase-total-card totals-quantities">
          <span>采购数量合计</span>
          <b>{{ totalQuantity() }}</b>
        </div>
        <div class="purchase-total-card totals-amount">
          <span>采购金额合计（元）</span>
          <b>{{ totals ? `¥${money(totals.purchaseAmount)}` : '—' }}</b>
        </div>
      </div>
    </template>
    <template #actions>
      <DhbPageSyncButton scope="PURCHASE_ORDER" label="采购单" @completed="load" /><el-button
        v-if="can('erp:procurement:create', 'erp:supply:write')"
        type="primary"
        :icon="Plus"
        @click="openEditor()"
        >新增采购单</el-button
      >
    </template>

    <template #default>
      <el-table
        v-loading="loading"
        :data="rows"
        height="100%"
        row-key="id"
        class="business-table purchase-orders-table"
        :header-cell-style="{ background: '#f7f9fc', color: '#475569' }"
      >
        <!-- @vue-generic {ProcurementOrderSummary} -->
        <el-table-column
          type="index"
          label="序号"
          width="48"
          :index="(i: number) => (page - 1) * size + i + 1"
          fixed="left"
        />
        <!-- @vue-generic {ProcurementOrderSummary} -->
        <el-table-column label="采购单号" width="168" fixed="left" show-overflow-tooltip>
          <template #default="{ row }"
            ><el-button link type="primary" @click="openEditor(row, true)">{{
              row.procurementNo
            }}</el-button></template
          >
        </el-table-column>
        <!-- @vue-generic {ProcurementOrderSummary} -->
        <el-table-column label="单据状态" width="88" align="center" fixed="left">
          <template #default="{ row }"
            ><el-tag :type="row.confirmationStatusCode === 'CONFIRMED' ? 'success' : 'info'">{{
              row.confirmationStatusCode === 'CONFIRMED'
                ? '已确认'
                : row.confirmationStatusCode === 'UNCONFIRMED'
                  ? '待确认'
                  : '待核验'
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column prop="supplierName" label="供应商" min-width="180" show-overflow-tooltip />
        <el-table-column prop="purchaseDate" label="采购日期" width="108" />
        <!-- @vue-generic {ProcurementOrderSummary} -->
        <el-table-column label="预计到货时间" width="180" class-name="purchase-date-cell">
          <template #default="{ row }">{{ displayDateTime(row.expectedArrivalTime) }}</template>
        </el-table-column>
        <!-- @vue-generic {ProcurementOrderSummary} -->
        <el-table-column
          prop="targetWarehouseName"
          label="收货仓库"
          width="130"
          show-overflow-tooltip
        />
        <!-- @vue-generic {ProcurementOrderSummary} -->
        <el-table-column label="采购数量" width="110" align="right" show-overflow-tooltip>
          <template #default="{ row }">{{ purchaseQuantity(row) }}</template>
        </el-table-column>
        <!-- @vue-generic {ProcurementOrderSummary} -->
        <el-table-column label="采购金额（元）" width="128" align="right">
          <template #default="{ row }"
            ><strong>{{ money(procurementPayable(row)) }}</strong></template
          >
        </el-table-column>
        <!-- @vue-generic {ProcurementOrderSummary} -->
        <el-table-column label="创建人" width="88" align="center" show-overflow-tooltip>
          <template #default="{ row }">{{ auditActorLabel(row.createdBy) }}</template>
        </el-table-column>
        <!-- @vue-generic {ProcurementOrderSummary} -->
        <el-table-column label="操作" width="168" fixed="right"
          ><template #default="{ row }"
            ><div class="row-actions">
              <el-button link type="primary" @click="openEditor(row, true)">查看</el-button
              ><template v-if="editableProcurement(row)"
                ><el-button
                  v-if="can('erp:procurement:update', 'erp:supply:write')"
                  link
                  type="primary"
                  @click="openEditor(row)"
                  >编辑</el-button
                ><el-button
                  v-if="can('erp:procurement:update', 'erp:supply:write')"
                  link
                  type="primary"
                  :loading="actingId === row.id"
                  @click="confirm(row)"
                  >确认</el-button
                ><el-button
                  v-if="can('erp:procurement:delete', 'erp:supply:write')"
                  link
                  type="danger"
                  @click="remove(row)"
                  >删除</el-button
                ></template
              >
            </div></template
          ></el-table-column
        >
        <template #empty
          ><el-empty :description="failed ? '加载失败，请重试' : '暂无采购订单'" :image-size="90"
            ><el-button v-if="failed" @click="load">重新加载</el-button></el-empty
          ></template
        >
      </el-table>
    </template>
    <template #pagination>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :page-sizes="[20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="load"
        @size-change="search"
      />
    </template>
  </ErpListWorkspace>
  <ErpProcurementEditor v-model="editorVisible" :order-id="editingId" @saved="load" />
  <ErpProcurementDetail v-model="detailVisible" :order-id="editingId" />
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { errorMessage } from '@/api/core/error'
import { displayDateTime } from '@/utils/business-date'
import { auditActorLabel } from '@/utils/audit-actor'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import {
  getProcurementOrders,
  confirmProcurementOrder,
  deleteProcurementOrder,
  type ProcurementOrderSummary,
  type ProcurementOrderQuery,
} from '@/api/core/erp-documents'
import {
  getErpSupplierProfiles,
  getErpInventoryWarehouses,
  type ErpSupplierProfileView,
  type ErpInternalWarehouseView,
} from '@/api/core/erp-internal'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { loadBusinessDictionaries } from '@/utils/business-dictionary'
import { editableProcurement, procurementPayable } from '@/utils/procurement'
import DhbPageSyncButton from '@/components/supply/DhbPageSyncButton.vue'
import ErpListWorkspace from '@/components/erp/ErpListWorkspace.vue'
import ErpProcurementDetail from '@/components/erp/ErpProcurementDetail.vue'
import ErpProcurementEditor from '@/components/erp/ErpProcurementEditor.vue'
const { can } = useSupplyPermissions()
const filters = reactive({
  procurementNo: '',
  supplierCode: '',
  targetWarehouseCode: '',
  confirmationStatusCode: '',
  dates: null as [string, string] | null,
})
const rows = ref<ProcurementOrderSummary[]>([]),
  total = ref(0),
  page = ref(1),
  size = ref(20),
  loading = ref(false),
  failed = ref(false),
  actingId = ref('')
const totals = ref<{ quantityByUnit: Record<string, number>; purchaseAmount: number } | null>(null)
const suppliers = ref<ErpSupplierProfileView[]>([]),
  warehouses = ref<ErpInternalWarehouseView[]>([]),
  supplierLoading = ref(false),
  warehouseLoading = ref(false)
const editorVisible = ref(false),
  editingId = ref<string>(),
  detailVisible = ref(false)
let request = 0,
  supplierRequest = 0,
  warehouseRequest = 0
async function load() {
  totals.value = null
  const token = ++request
  loading.value = true
  failed.value = false
  try {
    const query: ProcurementOrderQuery = {
      begin: (page.value - 1) * size.value,
      step: size.value,
      procurementNo: filters.procurementNo.trim() || undefined,
      supplierCode: filters.supplierCode || undefined,
      targetWarehouseCode: filters.targetWarehouseCode || undefined,
      confirmationStatusCode: filters.confirmationStatusCode || undefined,
      purchaseDateFrom: filters.dates?.[0],
      purchaseDateTo: filters.dates?.[1],
    }
    const data = await getProcurementOrders(query)
    if (token !== request) return
    rows.value = data.items
    total.value = data.total
    totals.value = data.totals || null
    if (page.value > 1 && !data.items.length) {
      page.value--
      void load()
    }
  } catch {
    if (token === request) {
      totals.value = null
      failed.value = true
      rows.value = []
      total.value = 0
      ElMessage.error('采购订单加载失败')
    }
  } finally {
    if (token === request) loading.value = false
  }
}
function search() {
  page.value = 1
  void load()
}
function reset() {
  Object.assign(filters, {
    procurementNo: '',
    supplierCode: '',
    targetWarehouseCode: '',
    confirmationStatusCode: '',
    dates: null,
  })
  search()
}
function openEditor(row?: ProcurementOrderSummary, view = false) {
  editingId.value = row ? String(row.id) : undefined
  if (view) detailVisible.value = true
  else editorVisible.value = true
}
async function confirm(row: ProcurementOrderSummary) {
  try {
    await ElMessageBox.confirm(
      `确认采购单 ${row.procurementNo}？确认后仅可查看。`,
      '确认采购订单',
      { type: 'warning', confirmButtonText: '确认采购单' },
    )
  } catch {
    return
  }
  actingId.value = row.id
  try {
    await confirmProcurementOrder(row.id, row.revision)
    ElMessage.success('采购单已确认')
    await load()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '确认失败，订单可能已变化，请刷新重试'))
  } finally {
    actingId.value = ''
  }
}
async function remove(row: ProcurementOrderSummary) {
  try {
    await ElMessageBox.confirm(`删除待确认采购单 ${row.procurementNo}？`, '删除采购订单', {
      type: 'warning',
      confirmButtonText: '删除',
    })
  } catch {
    return
  }
  try {
    await deleteProcurementOrder(row.id, row.revision)
    ElMessage.success('已删除')
    await load()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '删除失败，请刷新后重试'))
  }
}
async function searchSuppliers(keyword: string) {
  const token = ++supplierRequest
  supplierLoading.value = true
  try {
    const data = await getErpSupplierProfiles({
      begin: 0,
      step: 50,
      supplierName: keyword || undefined,
    })
    if (token === supplierRequest) suppliers.value = data.items
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '供应商加载失败'))
  } finally {
    if (token === supplierRequest) supplierLoading.value = false
  }
}
async function searchWarehouses(keyword: string) {
  const token = ++warehouseRequest
  warehouseLoading.value = true
  try {
    const data = await getErpInventoryWarehouses({
      begin: 0,
      step: 50,
      warehouseName: keyword || undefined,
    })
    if (token === warehouseRequest) warehouses.value = data.items
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '仓库加载失败'))
  } finally {
    if (token === warehouseRequest) warehouseLoading.value = false
  }
}
const money = (n: number) =>
  Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function purchaseQuantity(row: ProcurementOrderSummary) {
  const quantities = Object.values(row.quantityByUnit || {})
  if (quantities.length) return formatQuantity(quantities)
  return row.totalQuantity == null ? '—' : formatQuantity([row.totalQuantity])
}
function formatQuantity(quantities: number[]) {
  return quantities
    .reduce((sum, quantity) => sum + Number(quantity), 0)
    .toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
function totalQuantity() {
  return totals.value ? formatQuantity(Object.values(totals.value.quantityByUnit)) : '—'
}
onMounted(() => {
  void load()
  void searchSuppliers('')
  void searchWarehouses('')
  void loadBusinessDictionaries([{ moduleCode: 'COMMON', code: 'PRODUCT_UNIT' }])
})
</script>
<style scoped>
.purchase-query .erp-query-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(360px, 100%), 1fr));
}
.purchase-totals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  flex: none;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--supply-border, #e2e8f0);
  border-radius: 6px;
  background: var(--supply-surface, #fff);
}
.purchase-total-card {
  --total-color: #2563eb;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 10px 14px 12px;
  border: 1px solid color-mix(in srgb, var(--total-color) 16%, transparent);
  border-top: 3px solid var(--total-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--total-color) 5%, var(--supply-surface, #fff));
}
.totals-amount {
  --total-color: #047857;
}
.purchase-total-card > span {
  color: var(--supply-text-muted, #64748b);
  font-size: 12px;
  line-height: 18px;
}
.purchase-total-card > b {
  color: var(--total-color);
  font-size: clamp(20px, 1.45vw, 24px);
  font-weight: 700;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
@media (max-width: 640px) {
  .purchase-totals {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 10px;
  }
}
.purchase-orders-table :deep(.cell) {
  padding-inline: 10px;
  font-variant-numeric: tabular-nums;
}
.purchase-orders-table :deep(th .cell),
.purchase-orders-table :deep(.purchase-date-cell .cell) {
  white-space: nowrap;
}
.purchase-orders-table :deep(.el-table__body .el-table__row) {
  height: 56px;
}
.purchase-orders-table :deep(.el-table__body .el-table__row .el-table__cell) {
  padding: 6px 0;
  vertical-align: middle;
}
.row-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  white-space: nowrap;
}
.row-actions :deep(.el-button) {
  margin: 0;
  padding: 2px 0;
}
.filter-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}
.filter-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
