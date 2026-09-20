<template>
  <div class="erp-product-price-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">ERP · 商品中心</span>
        <SupplyPageTitle>商品价格</SupplyPageTitle>
        <p>按客户类型维护商品等级价；切换客户类型或单位口径查看对应价格，支持导入订货宝导出的等级价表格。</p>
      </div>
      <div class="heading-actions">
        <el-button v-if="canWrite" type="primary" @click="importVisible = true">导入价格</el-button>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="submitSearch">
        <el-form-item label="客户类型" required>
          <el-select
            v-model="customerTypeCode"
            placeholder="选择客户类型"
            style="width: 180px"
            :disabled="loading || !customerTypes.length"
          >
            <el-option v-for="type in customerTypes" :key="type.code" :label="type.name" :value="type.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="单位维度">
          <el-radio-group v-model="unitMode">
            <el-radio-button v-for="option in unitModeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="商品编码">
          <el-input v-model="filters.productCode" clearable placeholder="输入商品编码" style="width: 180px" />
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input v-model="filters.productName" clearable placeholder="输入商品名称" style="width: 220px" />
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="result-heading">
      <div class="result-title-line">
        <h2>商品价格列表</h2>
        <span class="result-count"><strong>{{ pageData.total }}</strong> 个商品</span>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          class="business-table supply-scroll-table"
          height="100%"
          v-loading="loading"
          :data="skuRows"
          row-key="variantId"
        >
          <el-table-column prop="productCode" label="商品编码" width="170" fixed="left" show-overflow-tooltip />
          <!-- @vue-generic {ProductPriceRow} -->
          <el-table-column label="订货宝编码" width="130" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.sourceDocumentNo || '—' }}</template>
          </el-table-column>
          <el-table-column label="商品名称" min-width="200" show-overflow-tooltip>
            <template #default="scope">
              <span class="record-name">{{ scope.row.productName || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="规格" min-width="160" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.specification }}</template>
          </el-table-column>
          <!-- @vue-generic {ProductPriceRow} -->
          <el-table-column label="单位" min-width="200" show-overflow-tooltip>
            <template #default="scope">{{ rowUnitText(scope.row) }}</template>
          </el-table-column>
          <!-- @vue-generic {ProductPriceRow} -->
          <el-table-column label="订货价" width="130" align="right">
            <template #default="scope">
              <span :class="{ 'price-empty': orderPriceDisplay(scope.row).muted }">
                {{ orderPriceDisplay(scope.row).text }}
              </span>
            </template>
          </el-table-column>
          <!-- @vue-generic {ProductPriceRow} -->
          <el-table-column :label="levelPriceColumnLabel" width="140" align="right">
            <template #default="scope">
              <span :class="{ 'price-empty': levelPriceDisplay(scope.row).muted }">
                {{ levelPriceDisplay(scope.row).text }}
              </span>
            </template>
          </el-table-column>
          <!-- @vue-generic {ProductPriceRow} -->
          <el-table-column label="等级价配置" width="120" align="center">
            <template #default="scope">
              <span :class="{ 'price-empty': configuredCount(scope.row) === 0 }">
                已设 {{ configuredCount(scope.row) }}/{{ customerTypes.length }}
              </span>
            </template>
          </el-table-column>
          <!-- @vue-generic {ProductPriceRow} -->
          <el-table-column label="更新时间" width="170">
            <template #default="scope">{{ formatTime(latestUpdatedTime(scope.row)) }}</template>
          </el-table-column>
          <!-- @vue-generic {ProductPriceRow} -->
          <el-table-column v-if="canWrite" label="操作" width="130" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openEditor(scope.row)">设置等级价</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无可维护的商品规格" /></template>
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

    <el-dialog v-model="editorVisible" title="设置等级价" width="min(760px, 95vw)" destroy-on-close>
      <div v-if="editingRow" class="editor-meta">
        <strong>{{ editingRow.productName }}</strong>
        <span>{{ editingRow.specification }}</span>
        <span>{{ rowUnitText(editingRow) }}</span>
        <span v-if="editingRow.orderPrice !== null">订货价 ¥{{ round4(editingRow.orderPrice) }}</span>
      </div>
      <div class="editor-list">
        <div v-for="item in formItems" :key="item.customerTypeCode" class="editor-row">
          <span class="editor-type">{{ item.customerTypeName }}</span>
          <el-input-number
            v-model="item.salePrice"
            :min="0"
            :precision="4"
            :step="0.1"
            :controls="false"
            placeholder="未设置"
            class="editor-price"
          />
          <el-input v-model="item.remark" clearable maxlength="200" placeholder="备注" class="editor-remark" />
          <span class="editor-hint">{{ conversionHint(item) }}</span>
        </div>
      </div>
      <p class="editor-tip">留空保存将清除该客户类型的等级价</p>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEditor">保存</el-button>
      </template>
    </el-dialog>

    <ErpProductPriceImportDialog
      v-model="importVisible"
      :customer-types="customerTypes"
      @imported="handleImported"
    />
  </div>
</template>

<script setup lang="ts">
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import ErpProductPriceImportDialog from './ErpProductPriceImportDialog.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getErpCustomerTypePrices,
  syncErpCustomerTypePrices,
  type ErpCustomerTypePriceItemCommand,
  type ErpCustomerTypePriceView,
} from '@/api/core/erp-customer-type-price'
import { getCrmCustomerTypes, type CrmDictionaryView } from '@/api/core/crm'
import {
  getErpManagedProducts,
  type ErpManagedProductSummary,
  type ErpPage,
} from '@/api/core/erp-product'
import { businessDictionaryLabel, loadBusinessDictionaries } from '@/utils/business-dictionary'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'

interface ProductPriceRow {
  variantId: string
  productCode: string
  sourceDocumentNo: string | null
  productName: string
  specification: string
  orderPrice: number | null
  unitCode: string | null
  middleUnitCode: string | null
  bigUnitCode: string | null
  baseToMiddleRate: number | null
  baseToBigRate: number | null
}

interface PriceFormItem {
  customerTypeCode: string
  customerTypeName: string
  salePrice: number | null
  remark: string
}

interface PriceDisplay {
  text: string
  muted: boolean
}

type UnitMode = 'base' | 'middle' | 'big'

const loading = ref(false)
const saving = ref(false)
const editorVisible = ref(false)
const importVisible = ref(false)
const unitMode = ref<UnitMode>('base')
const customerTypeCode = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<ErpPage<ErpManagedProductSummary>>({ total: 0, begin: 0, step: 20, items: [] })
const customerTypes = ref<CrmDictionaryView[]>([])
const priceIndex = ref(new Map<string, ErpCustomerTypePriceView>())
const editingRow = ref<ProductPriceRow | null>(null)
const formItems = ref<PriceFormItem[]>([])

const { can } = useSupplyPermissions()
const canWrite = computed(() => can('erp:product-price:write'))

const filters = reactive({
  productCode: '',
  productName: '',
})

const skuRows = computed<ProductPriceRow[]>(() => {
  const rows: ProductPriceRow[] = []
  for (const product of pageData.value.items) {
    const variants = product.variants ?? []
    if (!variants.length) continue
    for (const variant of variants) {
      rows.push({
        variantId: String(variant.id),
        productCode: product.productCode,
        sourceDocumentNo: product.sourceDocumentNo,
        productName: product.productName,
        specification: variant.specificationSnapshot || '单规格',
        orderPrice: variant.salePrice,
        unitCode: variant.unitCode || product.unitCode,
        middleUnitCode: product.middleUnitCode,
        bigUnitCode: product.bigUnitCode,
        baseToMiddleRate: product.baseToMiddleRate,
        baseToBigRate: product.baseToBigRate,
      })
    }
  }
  return rows
})

const selectedCustomerTypeName = computed(
  () => customerTypes.value.find((type) => type.code === customerTypeCode.value)?.name ?? '',
)

const levelPriceColumnLabel = computed(() =>
  selectedCustomerTypeName.value ? `等级价（${selectedCustomerTypeName.value}）` : '等级价',
)

const unitModeOptions = computed<Array<{ value: UnitMode; label: string }>>(() => [
  { value: 'base', label: unitModeLabel('基础单位', firstUnitCode('unitCode')) },
  { value: 'middle', label: unitModeLabel('中包装', firstUnitCode('middleUnitCode')) },
  { value: 'big', label: unitModeLabel('大包装', firstUnitCode('bigUnitCode')) },
])

onMounted(() => {
  void loadBusinessDictionaries([{ moduleCode: 'COMMON', code: 'PRODUCT_UNIT' }])
  void initialize()
})

async function initialize() {
  loading.value = true
  try {
    const [page, types] = await Promise.all([
      fetchProductPage(),
      getCrmCustomerTypes({ begin: 0, step: 200 }),
    ])
    pageData.value = page
    customerTypes.value = types.items.filter((item) => item.status === 'ACTIVE')
    if (!customerTypeCode.value) customerTypeCode.value = customerTypes.value[0]?.code ?? ''
    await loadPrices(page.items.map((item) => String(item.id)))
  } catch (reason) {
    priceIndex.value = new Map()
    ElMessage.error(errorMessage(reason, '商品价格加载失败'))
  } finally {
    loading.value = false
  }
}

async function loadRows() {
  loading.value = true
  try {
    const page = await fetchProductPage()
    pageData.value = page
    await loadPrices(page.items.map((item) => String(item.id)))
  } catch (reason) {
    priceIndex.value = new Map()
    ElMessage.error(errorMessage(reason, '商品价格加载失败'))
  } finally {
    loading.value = false
  }
}

function fetchProductPage() {
  return getErpManagedProducts({
    begin: (currentPage.value - 1) * pageSize.value,
    step: pageSize.value,
    productCode: empty(filters.productCode),
    productName: empty(filters.productName),
    withVariants: true,
  })
}

async function loadPrices(productIds: string[]) {
  if (!productIds.length) {
    priceIndex.value = new Map()
    return
  }
  const views = await getErpCustomerTypePrices(productIds.join(','))
  const next = new Map<string, ErpCustomerTypePriceView>()
  for (const view of views) next.set(priceKey(view.productVariantId, view.customerTypeCode), view)
  priceIndex.value = next
}

function submitSearch() {
  currentPage.value = 1
  void loadRows()
}

function resetFilters() {
  filters.productCode = ''
  filters.productName = ''
  currentPage.value = 1
  void loadRows()
}

function handleSizeChange() {
  currentPage.value = 1
  void loadRows()
}

function handleImported() {
  void loadRows()
}

function priceKey(variantId: string, typeCode: string): string {
  return `${variantId}::${typeCode}`
}

function priceEntry(row: ProductPriceRow, typeCode: string): ErpCustomerTypePriceView | undefined {
  return priceIndex.value.get(priceKey(row.variantId, typeCode))
}

function selectedPriceEntry(row: ProductPriceRow): ErpCustomerTypePriceView | undefined {
  return priceIndex.value.get(priceKey(row.variantId, customerTypeCode.value))
}

function currentRate(row: ProductPriceRow): number | null {
  if (unitMode.value === 'middle') return row.baseToMiddleRate
  if (unitMode.value === 'big') return row.baseToBigRate
  return null
}

function priceDisplay(
  value: number | null | undefined,
  row: ProductPriceRow,
  emptyText: string,
): PriceDisplay {
  if (value === null || value === undefined) return { text: emptyText, muted: true }
  if (unitMode.value === 'base') return { text: `¥${round4(value)}`, muted: false }
  const rate = currentRate(row)
  if (!rate) return { text: '无换算', muted: true }
  return { text: `¥${round4(value * rate)}`, muted: false }
}

function orderPriceDisplay(row: ProductPriceRow): PriceDisplay {
  return priceDisplay(row.orderPrice, row, '—')
}

function levelPriceDisplay(row: ProductPriceRow): PriceDisplay {
  return priceDisplay(selectedPriceEntry(row)?.salePrice, row, '未设置')
}

function configuredCount(row: ProductPriceRow): number {
  let count = 0
  for (const type of customerTypes.value) {
    const entry = priceEntry(row, type.code)
    if (entry && entry.salePrice !== null) count += 1
  }
  return count
}

function latestUpdatedTime(row: ProductPriceRow): string {
  let latest = ''
  for (const type of customerTypes.value) {
    const entry = priceEntry(row, type.code)
    if (!entry || entry.salePrice === null || !entry.updatedTime) continue
    if (entry.updatedTime > latest) latest = entry.updatedTime
  }
  return latest
}

function openEditor(row: ProductPriceRow) {
  editingRow.value = row
  formItems.value = customerTypes.value.map((type) => {
    const entry = priceEntry(row, type.code)
    return {
      customerTypeCode: type.code,
      customerTypeName: type.name,
      salePrice: entry?.salePrice ?? null,
      remark: entry?.remark ?? '',
    }
  })
  editorVisible.value = true
}

async function saveEditor() {
  const row = editingRow.value
  if (!row) return
  const items: ErpCustomerTypePriceItemCommand[] = []
  for (const item of formItems.value) {
    if (item.salePrice === null || item.salePrice === undefined) continue
    items.push({
      customerTypeCode: item.customerTypeCode,
      salePrice: item.salePrice,
      remark: item.remark.trim() || null,
    })
  }
  saving.value = true
  try {
    const views = await syncErpCustomerTypePrices(row.variantId, items)
    applyVariantPrices(row.variantId, views)
    editorVisible.value = false
    ElMessage.success('等级价已保存')
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '等级价保存失败'))
  } finally {
    saving.value = false
  }
}

function applyVariantPrices(variantId: string, views: ErpCustomerTypePriceView[]) {
  const next = new Map(priceIndex.value)
  for (const key of [...next.keys()]) {
    if (key.startsWith(`${variantId}::`)) next.delete(key)
  }
  for (const view of views) next.set(priceKey(view.productVariantId, view.customerTypeCode), view)
  priceIndex.value = next
}

function conversionHint(item: PriceFormItem): string {
  const row = editingRow.value
  const price = item.salePrice
  if (!row || price === null || price === undefined) return ''
  const parts: string[] = []
  if (row.middleUnitCode && row.baseToMiddleRate) {
    parts.push(`≈ ${round4(price * row.baseToMiddleRate)} 元/${unitLabel(row.middleUnitCode)}`)
  }
  if (row.bigUnitCode && row.baseToBigRate) {
    parts.push(`≈ ${round4(price * row.baseToBigRate)} 元/${unitLabel(row.bigUnitCode)}`)
  }
  return parts.join(' · ')
}

function rowUnitText(row: ProductPriceRow): string {
  const extras: string[] = []
  if (row.middleUnitCode && row.baseToMiddleRate) {
    extras.push(`中 ${unitLabel(row.middleUnitCode)}×${round4(row.baseToMiddleRate)}`)
  }
  if (row.bigUnitCode && row.baseToBigRate) {
    extras.push(`大 ${unitLabel(row.bigUnitCode)}×${round4(row.baseToBigRate)}`)
  }
  const base = row.unitCode ? unitLabel(row.unitCode) : '基础单位'
  return extras.length ? `${base}（${extras.join(' / ')}）` : base
}

function firstUnitCode(key: 'unitCode' | 'middleUnitCode' | 'bigUnitCode'): string | null {
  for (const row of skuRows.value) {
    const code = row[key]
    if (code) return code
  }
  return null
}

function unitModeLabel(fallback: string, code: string | null): string {
  return code ? `${fallback}（${unitLabel(code)}）` : fallback
}

function unitLabel(value: string | null | undefined): string {
  if (!value) return '-'
  return businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', value, '单位')
}

function round4(value: number): number {
  return Number(value.toFixed(4))
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replace('T', ' ').replace(/\.\d+Z?$/, '')
}

function empty(value: string | null | undefined): string | undefined {
  const text = value?.trim()
  return text ? text : undefined
}

function errorMessage(reason: unknown, fallback: string): string {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.erp-product-price-page {
  min-height: 100%;
}

.price-empty {
  color: $color-text-placeholder;
}

.editor-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: baseline;
  padding-bottom: 12px;
  border-bottom: 1px solid $color-border-light;
  color: $color-text-secondary;

  strong {
    color: $color-text-primary;
  }
}

.editor-list {
  max-height: 46vh;
  overflow-y: auto;
  padding: 4px 0;
}

.editor-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 160px 190px 170px;
  gap: 12px;
  align-items: center;
  padding: 8px 0;

  + .editor-row {
    border-top: 1px solid $color-border-lighter;
  }
}

.editor-type {
  color: $color-text-regular;
}

.editor-hint {
  color: $color-text-placeholder;
  font-size: $font-size-xs;
}

.editor-tip {
  margin: 8px 0 0;
  color: $color-text-secondary;
  font-size: $font-size-xs;
}
</style>
