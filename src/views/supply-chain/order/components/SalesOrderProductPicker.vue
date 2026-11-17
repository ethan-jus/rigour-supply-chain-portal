<template>
  <el-dialog
    v-model="visible"
    title="选择销售商品"
    width="min(1120px, 96vw)"
    top="6vh"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
  >
    <form
      class="list-filter-bar product-filters"
      aria-label="筛选销售商品"
      @submit.prevent="search"
    >
      <div class="list-filter-field list-filter-field--text">
        <el-input
          v-model="filters.productName"
          aria-label="商品名称"
          placeholder="商品名称"
          clearable
        />
      </div>
      <div class="list-filter-field list-filter-field--text">
        <el-input
          v-model="filters.productCode"
          aria-label="商品编码"
          placeholder="商品编码"
          clearable
        />
      </div>
      <el-button native-type="submit" type="primary" :loading="loading">查询</el-button>
      <el-button @click="reset">重置</el-button>
    </form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <p class="selection-note">
      已选 {{ selected.size }} 个规格；可跨页选择。已在订单中的规格不能重复添加。
    </p>
    <el-table
      ref="table"
      v-loading="loading"
      :data="rows"
      row-key="key"
      height="min(420px, 48vh)"
      empty-text="暂无可选规格，请调整查询条件或维护商品资料"
      @select="selectRow"
      @select-all="selectPage"
    >
      <el-table-column type="selection" width="48" :selectable="selectable" />
      <el-table-column prop="productCode" label="商品编码" width="155" show-overflow-tooltip />
      <el-table-column prop="productName" label="商品名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="specification" label="规格" min-width="170" show-overflow-tooltip />
      <el-table-column prop="variantCode" label="SKU编码" width="165" show-overflow-tooltip />
      <el-table-column label="单位" width="80"
        ><template #default="{ row }">{{ unit(row.unitCode) }}</template></el-table-column
      >
      <el-table-column label="销售参考价（元）" width="150" align="right"
        ><template #default="{ row }">
          {{ row.salePrice == null ? '待填写' : Number(row.salePrice).toFixed(2) }}
        </template></el-table-column
      >
    </el-table>
    <div class="picker-footer">
      <span>按商品分页，当前 {{ rows.length }} 个规格</span>
      <CompactPagination
        v-model:current-page="page"
        v-model:page-size="step"
        :total="total"
        @current-change="load"
        @size-change="search"
      />
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="loading || !selected.size" @click="confirm"
        >添加已选商品（{{ selected.size }}）</el-button
      >
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { type TableInstance } from 'element-plus'
import {
  getErpManagedProducts,
  type ErpManagedProductSummary,
  type ErpManagedProductVariant,
} from '@/api/core/erp-product'
import { errorMessage } from '@/api/core/error'
import { businessDictionaryLabel } from '@/utils/business-dictionary'
import CompactPagination from '@/components/supply/CompactPagination.vue'

export interface SalesProductChoice {
  key: string
  productId: string
  variantId: string
  productCode: string
  productName: string
  variantCode: string
  specification: string | null
  unitCode: string | null
  salePrice: number | null
  variants: ErpManagedProductVariant[]
}
const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ excludedKeys: string[] }>()
const emit = defineEmits<{ selected: [rows: SalesProductChoice[]] }>()
const excluded = computed(() => new Set(props.excludedKeys))
const filters = reactive({ productName: '', productCode: '' })
const page = ref(1),
  step = ref(20),
  total = ref(0),
  loading = ref(false),
  error = ref('')
const rows = ref<SalesProductChoice[]>([]),
  table = ref<TableInstance>()
const selected = ref(new Map<string, SalesProductChoice>())
let request = 0
const unit = (code: string | null) =>
  code ? businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', code, code) : '-'
const selectable = (row: SalesProductChoice) => !excluded.value.has(row.key) && !!row.unitCode
function choices(product: ErpManagedProductSummary): SalesProductChoice[] {
  return (product.variants || []).map((v) => ({
    key: `${product.id}:${v.id}`,
    productId: String(product.id),
    variantId: String(v.id),
    productCode: product.productCode,
    productName: product.productName,
    variantCode: v.variantCode,
    specification: v.specificationSnapshot || product.productSpecification,
    unitCode: v.unitCode || product.unitCode,
    salePrice: v.salePrice,
    variants: product.variants,
  }))
}
async function load() {
  const token = ++request
  loading.value = true
  error.value = ''
  try {
    // 一次批量带规格，避免对每行商品再请求详情。
    const result = await getErpManagedProducts({
      begin: (page.value - 1) * step.value,
      step: step.value,
      productName: filters.productName.trim() || undefined,
      productCode: filters.productCode.trim() || undefined,
      shelfStatusCode: 'ON_SHELF',
      submitStatusCode: 'SUBMITTED',
      withVariants: true,
    })
    if (token !== request || !visible.value) return
    rows.value = result.items.flatMap(choices)
    total.value = result.total
    await nextTick()
    rows.value.forEach((row) =>
      table.value?.toggleRowSelection(row, selected.value.has(row.key) && selectable(row)),
    )
  } catch (e) {
    if (token === request) {
      rows.value = []
      error.value = errorMessage(e, '商品加载失败，请重试')
    }
  } finally {
    if (token === request) loading.value = false
  }
}
function selectRow(checked: SalesProductChoice[], row: SalesProductChoice) {
  if (selectable(row) && checked.some((item) => item.key === row.key))
    selected.value.set(row.key, row)
  else selected.value.delete(row.key)
}
function selectPage(checked: SalesProductChoice[]) {
  rows.value.forEach((row) => selectRow(checked, row))
}
function search() {
  page.value = 1
  void load()
}
function reset() {
  Object.assign(filters, { productName: '', productCode: '' })
  search()
}
function confirm() {
  const result = [...selected.value.values()].filter(selectable)
  if (loading.value || error.value || !result.length) return
  emit('selected', result)
  visible.value = false
}
watch(
  visible,
  (open) => {
    if (open) {
      selected.value = new Map()
      reset()
    } else {
      request++
      loading.value = false
    }
  },
  { immediate: true },
)
</script>
<style scoped lang="scss">
.product-filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.selection-note {
  color: var(--el-text-color-secondary);
  margin: 12px 0;
}
.picker-footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-top: 14px;
}
.picker-footer > span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
