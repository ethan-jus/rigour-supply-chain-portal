<template>
  <el-dialog
    v-model="visible"
    title="选择采购商品"
    class="erp-product-picker"
    top="8vh"
    width="min(1200px, 96vw)"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form label-width="76px" class="picker-query" @submit.prevent="search">
      <div class="picker-query-grid">
        <el-form-item label="商品名称"
          ><el-input v-model="filters.productName" placeholder="输入商品名称" clearable
        /></el-form-item>
        <el-form-item label="商品编码"
          ><el-input v-model="filters.productCode" placeholder="输入商品编码" clearable
        /></el-form-item>
        <el-form-item label="SKU编码"
          ><el-input v-model="filters.variantCode" placeholder="输入SKU编码" clearable
        /></el-form-item>
      </div>
      <div class="picker-query-actions">
        <el-button type="primary" native-type="submit" :loading="loading">查询</el-button
        ><el-button @click="reset">重置</el-button>
      </div>
    </el-form>
    <div class="selection-note">
      已选 {{ selected.size }} 个商品 <span>已在采购单中的商品不可重复添加</span>
    </div>
    <el-table
      ref="table"
      v-loading="loading"
      :data="items"
      row-key="variantCode"
      :height="'min(400px, 44vh)'"
      @select="selectRow"
      @select-all="selectPage"
    >
      <!-- @vue-generic {ProcurementProduct} -->
      <el-table-column type="selection" width="48" :selectable="selectable" />
      <!-- @vue-generic {ProcurementProduct} -->
      <el-table-column prop="productCode" label="商品编码" width="170" show-overflow-tooltip />
      <!-- @vue-generic {ProcurementProduct} -->
      <el-table-column prop="productName" label="商品名称" min-width="180" show-overflow-tooltip />
      <!-- @vue-generic {ProcurementProduct} -->
      <el-table-column prop="variantCode" label="SKU编码" width="170" show-overflow-tooltip />
      <!-- @vue-generic {ProcurementProduct} -->
      <el-table-column prop="specification" label="规格" min-width="140" show-overflow-tooltip />
      <!-- @vue-generic {ProcurementProduct} -->
      <el-table-column label="小单位" width="70"
        ><template #default="{ row }">{{ unit(row.baseUnitCode) }}</template></el-table-column
      >
      <!-- @vue-generic {ProcurementProduct} -->
      <el-table-column label="中单位" width="70"
        ><template #default="{ row }">{{ unit(row.middleUnitCode) }}</template></el-table-column
      >
      <!-- @vue-generic {ProcurementProduct} -->
      <el-table-column label="大单位" width="70"
        ><template #default="{ row }">{{ unit(row.bigUnitCode) }}</template></el-table-column
      >
      <!-- @vue-generic {ProcurementProduct} -->
      <el-table-column label="参考采购价" width="120" align="right"
        ><template #default="{ row }">{{
          row.purchasePrice == null ? '—' : row.purchasePrice
        }}</template></el-table-column
      >
    </el-table>
    <div class="picker-pagination">
      <el-pagination
        v-model:current-page="page"
        :total="total"
        :page-size="20"
        layout="total, prev, pager, next"
        @current-change="load"
      />
    </div>
    <template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button type="primary" :disabled="selected.size === 0" @click="confirm"
        >添加已选商品（{{ selected.size }}）</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import { errorMessage } from '@/api/core/error'
import { ElMessage, type TableInstance } from 'element-plus'
import { getProcurementProducts, type ProcurementProduct } from '@/api/core/erp-documents'
import { businessDictionaryLabel } from '@/utils/business-dictionary'
const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ excludedCodes: string[] }>()
const emit = defineEmits<{ selected: [products: ProcurementProduct[]] }>()
const filters = reactive({ productName: '', productCode: '', variantCode: '' })
const page = ref(1),
  total = ref(0),
  loading = ref(false),
  items = ref<ProcurementProduct[]>([]),
  table = ref<TableInstance>()
const selected = ref(new Map<string, ProcurementProduct>())
let request = 0
const unit = (code?: string | null) =>
  code ? businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', code, code) : '—'
const selectable = (row: ProcurementProduct) => !props.excludedCodes.includes(row.variantCode)
async function load() {
  const token = ++request
  loading.value = true
  try {
    const data = await getProcurementProducts({
      begin: (page.value - 1) * 20,
      step: 20,
      productName: filters.productName.trim() || undefined,
      productCode: filters.productCode.trim() || undefined,
      variantCode: filters.variantCode.trim() || undefined,
    })
    if (token !== request) return
    items.value = data.items
    total.value = data.total
    await nextTick()
    items.value.forEach((row) =>
      table.value?.toggleRowSelection(row, selected.value.has(row.variantCode), true),
    )
  } catch (reason) {
    if (token === request) ElMessage.error(errorMessage(reason, '商品列表加载失败'))
  } finally {
    if (token === request) loading.value = false
  }
}
function selectRow(rows: ProcurementProduct[], row: ProcurementProduct) {
  if (rows.some((item) => item.variantCode === row.variantCode))
    selected.value.set(row.variantCode, row)
  else selected.value.delete(row.variantCode)
}
function selectPage(rows: ProcurementProduct[]) {
  items.value.filter(selectable).forEach((row) => selectRow(rows, row))
}
function search() {
  page.value = 1
  void load()
}
function reset() {
  Object.assign(filters, { productName: '', productCode: '', variantCode: '' })
  search()
}
function confirm() {
  emit('selected', [...selected.value.values()].filter(selectable))
  visible.value = false
}
watch(visible, (value) => {
  if (value) {
    selected.value = new Map()
    Object.assign(filters, { productName: '', productCode: '', variantCode: '' })
    page.value = 1
    void load()
  } else request++
})
</script>
<style scoped>
:global(.erp-product-picker.el-dialog) {
  display: flex;
  flex-direction: column;
  max-height: 88dvh;
  padding: 0;
  overflow: hidden;
  border-radius: 8px;
}
:global(.erp-product-picker .el-dialog__header) {
  padding: 18px 20px;
  margin: 0;
  border-bottom: 1px solid #e2e8f0;
  flex: none;
}
:global(.erp-product-picker .el-dialog__title) {
  font-size: 17px;
  font-weight: 600;
}
:global(.erp-product-picker .el-dialog__body) {
  padding: 16px 20px;
  min-height: 0;
  overflow: auto;
}
:global(.erp-product-picker .el-dialog__footer) {
  padding: 12px 20px;
  border-top: 1px solid #e2e8f0;
  flex: none;
}

.picker-query {
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 14px;
}
.picker-query-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 20px;
}
.picker-query-grid :deep(.el-form-item) {
  margin: 0;
}
.picker-query-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}
@media (max-width: 900px) {
  .picker-query-grid {
    grid-template-columns: 1fr;
  }
}

.selection-note {
  margin: 0 0 12px;
  color: #334155;
}
.selection-note span {
  margin-left: 16px;
  color: #64748b;
  font-size: 13px;
}
.picker-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
