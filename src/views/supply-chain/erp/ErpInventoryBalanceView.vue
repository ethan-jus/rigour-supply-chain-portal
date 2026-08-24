<template>
  <div class="erp-inventory-balance-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">ERP · 库存管理</span>
        <h1>库存</h1>
        <p>按仓库、商品和规格查看当前库存余额；库存变动必须通过入库单、出库单或调拨单形成流水。</p>
      </div>
      <el-tag type="info" effect="plain">只读</el-tag>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="loadRows">
        <el-form-item label="商品编码">
          <el-input v-model="filters.productCode" clearable placeholder="商品编码" style="width: 170px" />
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input v-model="filters.productName" clearable placeholder="商品名称" style="width: 220px" />
        </el-form-item>
        <el-form-item label="仓库名称">
          <el-input v-model="filters.warehouseName" clearable placeholder="仓库名称" style="width: 190px" />
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="result-heading">
      <div>
        <div class="result-title-line">
          <h2>库存列表</h2>
          <span class="result-count"><strong>{{ pageData.total }}</strong> 条</span>
        </div>
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
        >
          <el-table-column type="index" label="序号" width="80" fixed="left" :index="tableRowIndex" />
          <el-table-column label="商品编码" width="150" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.productCode || '-' }}</template>
          </el-table-column>
          <el-table-column label="商品名称" min-width="240" show-overflow-tooltip>
            <template #default="scope">
              <div class="record-identity">
                <span class="record-avatar">存</span>
                <div class="record-identity-content">
                  <strong>{{ scope.row.productName || '-' }}</strong>
                  <small>{{ scope.row.variantCode || scope.row.specificationSnapshot || '默认规格' }}</small>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="规格编码" width="150" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.variantCode || '-' }}</template>
          </el-table-column>
          <el-table-column label="规格" min-width="180" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.specificationSnapshot || '-' }}</template>
          </el-table-column>
          <el-table-column label="仓库编码" width="150" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.warehouseCode || '-' }}</template>
          </el-table-column>
          <el-table-column label="仓库名称" min-width="190" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.warehouseName || '-' }}</template>
          </el-table-column>
          <el-table-column label="单位" width="100">
            <template #default="scope">{{ unitLabel(scope.row.unitCode) }}</template>
          </el-table-column>
          <el-table-column label="可用库存" width="130" align="right">
            <template #default="scope">{{ formatNumber(scope.row.availableQuantity) }}</template>
          </el-table-column>
          <el-table-column label="锁定库存" width="130" align="right">
            <template #default="scope">{{ formatNumber(scope.row.lockedQuantity) }}</template>
          </el-table-column>
          <el-table-column label="在途库存" width="130" align="right">
            <template #default="scope">{{ formatNumber(scope.row.inTransitQuantity) }}</template>
          </el-table-column>
          <el-table-column label="更新时间" width="180" fixed="right">
            <template #default="scope">{{ formatTime(scope.row.updatedTime) }}</template>
          </el-table-column>
          <template #empty><el-empty description="暂无库存" /></template>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getErpStockBalances,
  type ErpInternalPage,
  type ErpStockBalanceView,
} from '@/api/core/erp-internal'
import {
  businessDictionaryLabel,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'

const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<ErpInternalPage<ErpStockBalanceView>>({ total: 0, begin: 0, step: 20, items: [] })

const filters = reactive({
  productCode: '',
  productName: '',
  warehouseName: '',
})

const hasFilter = computed(() =>
  Boolean(filters.productCode.trim() || filters.productName.trim() || filters.warehouseName.trim()),
)

onMounted(() => {
  void loadBusinessDictionaries([{ moduleCode: 'COMMON', code: 'PRODUCT_UNIT' }])
  void loadRows()
})

async function loadRows() {
  loading.value = true
  try {
    pageData.value = await getErpStockBalances({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      productCode: empty(filters.productCode),
      productName: empty(filters.productName),
      warehouseName: empty(filters.warehouseName),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '库存列表加载失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.productCode = ''
  filters.productName = ''
  filters.warehouseName = ''
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

defineExpose({ hasFilter, loadRows })
</script>

<style scoped lang="scss">
.erp-inventory-balance-page {
  min-height: 0;
}
</style>
