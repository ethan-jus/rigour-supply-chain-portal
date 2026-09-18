<template>
  <el-dialog
    :model-value="modelValue"
    title="城市商品报表"
    width="min(1200px, 96vw)"
    top="3vh"
    append-to-body
    destroy-on-close
    @update:model-value="updateVisible"
  >
    <div class="city-product-report" :aria-busy="loading">
      <nav class="report-navigation" aria-label="商品分析钻取路径">
        <el-button
          v-if="drillHistory.length"
          :icon="Back"
          :disabled="loading"
          @click="returnToPrevious"
          >返回上一步</el-button
        >
        <span>城市商品分析</span>
        <span v-if="appliedQuery?.regionCode"> / {{ appliedCityName }}</span>
        <span v-if="appliedQuery?.productId || appliedQuery?.skuId">
          / {{ appliedProductScope }}</span
        >
      </nav>
      <div class="report-toolbar">
        <div v-show="filtersExpanded" class="report-field">
          <span>报表类型</span>
          <el-select v-model="reportKind" aria-label="报表类型">
            <el-option
              v-for="(name, key) in businessReportNames"
              :key="key"
              :label="name"
              :value="key"
            />
            <el-option label="核对明细" value="details" />
          </el-select>
        </div>
        <div v-show="filtersExpanded" class="report-field report-field--dates">
          <span>订单日期（北京时间）</span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            aria-label="订单日期范围"
          />
        </div>
        <div
          v-for="filter in queryFilters"
          v-show="filtersExpanded"
          :key="filter.key"
          class="report-field"
        >
          <span>{{ filter.label }}</span>
          <el-select
            v-model="draftQuery[filter.key]"
            :aria-label="filter.label"
            filterable
            clearable
          >
            <el-option label="全部" value="" />
            <el-option
              v-for="option in filterOptions?.[filter.options] ?? []"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
            <el-option
              v-if="
                draftQuery[filter.key] &&
                !filterOptions?.[filter.options]?.some(
                  (option) => option.value === draftQuery[filter.key],
                )
              "
              label="名称待补全"
              :value="draftQuery[filter.key] || ''"
            />
          </el-select>
        </div>
        <div v-show="filtersExpanded" class="report-field">
          <span>商品分类</span>
          <el-tree-select
            v-model="categoryId"
            aria-label="商品分类"
            :data="categoryTree"
            check-strictly
            filterable
            clearable
            @change="changeProductScope"
            placeholder="全部分类（含下级）"
          />
        </div>
        <div v-show="filtersExpanded" class="report-field">
          <span>品牌</span>
          <el-select
            v-model="brandId"
            aria-label="品牌"
            filterable
            clearable
            @change="changeProductScope"
          >
            <el-option
              v-for="brand in brands"
              :key="brand.id"
              :value="String(brand.id)"
              :label="brand.brandName"
            />
            <el-option
              v-if="brandId && !brands.some((row) => String(row.id) === brandId)"
              :value="brandId"
              label="品牌名称待补全"
            />
          </el-select>
        </div>
        <div v-show="filtersExpanded" class="report-field">
          <span>商品</span>
          <el-select
            v-model="productId"
            aria-label="商品"
            filterable
            remote
            clearable
            :remote-method="searchProducts"
            :loading="productsLoading"
            @change="changeProduct"
          >
            <el-option
              v-for="product in products"
              :key="product.id"
              :value="String(product.id)"
              :label="product.productName"
            />
            <el-option
              v-if="productId && !products.some((row) => String(row.id) === productId)"
              :value="productId"
              :label="selectedProduct?.productName || '商品名称待补全'"
            />
          </el-select>
        </div>
        <div v-show="filtersExpanded" class="report-field">
          <span>SKU规格</span>
          <el-select
            v-model="skuId"
            aria-label="SKU规格"
            filterable
            clearable
            :disabled="!productId && !skuId"
            @change="load"
          >
            <el-option
              v-for="sku in selectedProduct?.variants ?? []"
              :key="sku.id"
              :value="String(sku.id)"
              :label="skuLabel(sku)"
            />
            <el-option
              v-if="skuId && !selectedProduct?.variants.some((row) => String(row.id) === skuId)"
              :value="skuId"
              label="规格名称待补全"
            />
          </el-select>
        </div>
        <div v-show="filtersExpanded" class="report-field report-field--mode">
          <span>回款口径</span>
          <el-select v-model="allocationMode" aria-label="回款分摊口径" @change="load">
            <el-option
              v-for="(label, value) in allocationModeLabels"
              :key="value"
              :value="value"
              :label="label"
            />
          </el-select>
        </div>
        <el-button
          :icon="Filter"
          :aria-expanded="filtersExpanded"
          @click="filtersExpanded = !filtersExpanded"
          >筛选条件</el-button
        >
        <el-button
          :icon="Refresh"
          :loading="loading"
          aria-label="重新查询城市商品报表"
          @click="load"
          >查询</el-button
        >
        <el-popover trigger="click" :width="520" :popper-style="{ maxWidth: 'calc(100vw - 32px)' }">
          <template #reference><el-button :icon="Setting">导出字段</el-button></template>
          <el-tabs v-model="fieldKind" aria-label="导出字段工作表">
            <el-tab-pane
              v-if="reportKind !== 'details'"
              name="business"
              :label="businessReportNames[reportKind]"
            />
            <el-tab-pane
              v-for="option in cityProductExportOptions"
              :key="option.value"
              :name="option.value"
              :label="option.label"
            />
          </el-tabs>
          <div class="report-field-actions">
            <el-button :icon="Select" @click="selectAllFields">全选</el-button>
            <el-button :icon="RefreshLeft" @click="resetFields">恢复默认</el-button>
          </div>
          <el-checkbox-group
            v-model="activeSelectedColumns"
            class="report-column-options"
            :aria-label="`${fieldKind}导出字段`"
          >
            <el-checkbox v-for="column in activeFieldColumns" :key="column.key" :value="column.key"
              >{{ 'group' in column && column.group ? `${column.group} · ` : ''
              }}{{ column.label }}</el-checkbox
            >
          </el-checkbox-group>
          <p v-if="fieldError" class="report-field-error" role="alert">{{ fieldError }}</p>
        </el-popover>
        <el-tooltip :disabled="!exportReason" :content="exportReason">
          <span class="report-export">
            <el-button
              data-testid="report-export"
              :icon="Download"
              :disabled="Boolean(exportReason)"
              :loading="exporting"
              @click="downloadExcel"
              >导出Excel</el-button
            >
          </span>
        </el-tooltip>
      </div>
      <p v-if="dimensionFailure" role="alert" class="report-field-error">
        {{ dimensionFailure }}
        <el-button link :icon="Refresh" @click="loadDimensions">重试</el-button>
      </p>
      <p v-if="hasDraftChanges" class="report-field-error" role="status">
        筛选条件尚未查询，以下仍为上次结果；查询后可继续核查和导出。
      </p>
      <div v-if="supplyEvidence?.warehouseId" class="supply-export-option">
        <el-checkbox v-model="includeSupply">Excel附带供货库存与全仓采购发货</el-checkbox>
        <span>{{ supplyEvidence.warehouseName }}</span>
      </div>

      <el-tabs v-if="reportKind === 'details'" v-model="detailKind" aria-label="报表核对范围">
        <el-tab-pane
          v-for="option in cityProductExportOptions"
          :key="option.value"
          :name="option.value"
          :label="option.label"
        />
      </el-tabs>
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" role="alert" />
      <el-alert
        v-if="exportError"
        :title="exportError"
        type="error"
        show-icon
        :closable="false"
        role="alert"
      />
      <el-alert
        v-if="exportNotice"
        :title="exportNotice"
        type="warning"
        show-icon
        :closable="false"
      />
      <el-skeleton v-if="loading" :rows="6" animated />
      <template v-else-if="report && !error">
        <el-alert
          v-if="report.exportBlocked || report.truncated"
          :title="blockedReason"
          type="warning"
          show-icon
          :closable="false"
        />
        <el-empty v-else-if="blockedReason" :description="blockedReason" />
        <template v-else-if="report.summary && selectedTotals">
          <p class="report-scope">
            {{ displayDate(report.from) }} 至 {{ displayDate(report.to) }}（北京时间） ·
            {{ appliedCityName }} · {{ appliedCategoryName }} · {{ appliedProductScope }} ·
            {{ allocationModeLabels[report.allocationMode] }}
            <span v-if="appliedOwnerName"> · {{ appliedOwnerName }}</span>
            · {{ report.summary.orderCount ?? '未提供' }} 笔订单 ·
            {{ report.summary.customerCount ?? '未提供' }} 个客户
            <span v-if="report.generatedAt"> · 生成于 {{ displayTime(report.generatedAt) }}</span>
            <span v-if="report.dataUpdatedAt">
              · 数据最近同步于 {{ displayTime(report.dataUpdatedAt) }}</span
            >
          </p>
          <p class="report-scope">
            {{ amountGrain === 'categoryRows' ? '城市分类归属口径' : '商品SKU单位归属口径' }}
          </p>
          <el-alert
            v-if="attributionIncomplete"
            :title="attributionNotice"
            type="warning"
            show-icon
            :closable="false"
          />
          <dl class="report-summary">
            <div>
              <dt>商品销售额</dt>
              <dd>{{ money(selectedTotals.salesAmount) }}</dd>
            </div>
            <div>
              <dt>已归属应收额</dt>
              <dd>{{ money(selectedTotals.receivableAmount) }}</dd>
            </div>
            <div>
              <dt>已归属回款额</dt>
              <dd>{{ money(selectedTotals.paidAmount) }}</dd>
            </div>
            <div v-if="report.allocationMode === 'PROPORTIONAL'">
              <dt>其中分摊回款</dt>
              <dd>{{ money(selectedTotals.allocatedPaidAmount) }}</dd>
            </div>
          </dl>
          <div class="report-quantities" aria-label="按原始单位统计订货数量（未扣退货）">
            <span>订货数量（未扣退货）</span>
            <span
              v-for="(quantity, index) in selectedTotals.quantities"
              :key="`${quantity.unitCode}-${index}`"
            >
              <strong>{{ reportQuantityText(quantity.quantity) || '—' }}</strong>
              {{ unitName(quantity.unitCode || '') }}
            </span>
            <span v-if="!selectedTotals.quantities.length">未提供数量</span>
          </div>
          <p v-if="quantityNotice" class="report-quantity-notice" role="status">
            {{ quantityNotice }}
          </p>
          <section class="report-chart" aria-label="城市商品销售额与已归属回款额对比">
            <h3>城市商品销售额与已归属回款额</h3>
            <EchartsChart
              v-if="chartRows.length"
              :option="chartOption"
              :height="300"
              @chart-click="investigateCity"
            />
            <el-empty v-else description="当前范围没有城市商品行数据" />
          </section>
          <CityProductInvestigation
            :report="report"
            :query="appliedQuery!"
            @select-product="investigateProduct"
          />
          <CityProductSupplyInvestigation
            v-if="supplyQuery && !hasDraftChanges"
            :query="supplyQuery"
            :sales-rows="report.rows"
            @evidence-change="supplyEvidence = $event"
          />
          <section v-if="reportKind !== 'details'" class="business-report-preview">
            <el-collapse v-model="businessExpanded">
              <el-collapse-item
                :title="`${businessReportNames[reportKind]} · 明细预览`"
                name="preview"
              >
                <el-alert
                  v-if="businessError"
                  :title="businessError"
                  type="warning"
                  :closable="false"
                  show-icon
                />
                <template v-else-if="businessPreview">
                  <el-table
                    :data="businessPage"
                    max-height="460"
                    :row-class-name="businessRowClass"
                    border
                  >
                    <!-- @vue-generic {BusinessRow} -->
                    <el-table-column
                      v-for="column in businessPreview.columns"
                      :key="column.key"
                      :label="column.group ? `${column.group} · ${column.label}` : column.label"
                      :min-width="
                        column.key === 'product' || column.key === 'quantities' ? 230 : 160
                      "
                      :fixed="column.key === 'city' ? 'left' : undefined"
                      :align="column.type ? 'right' : 'left'"
                    >
                      <template #default="scope">{{ businessCell(scope.row, column) }}</template>
                    </el-table-column>
                  </el-table>
                  <el-pagination
                    v-model:current-page="businessPageNumber"
                    :page-size="100"
                    :total="businessPreview.rows.length"
                    layout="total, prev, pager, next"
                    small
                  />
                </template>
              </el-collapse-item>
            </el-collapse>
          </section>
          <el-collapse v-model="expandedDetails">
            <el-collapse-item title="核对明细" name="details">
              <el-table :data="visibleRows" max-height="420" border stripe>
                <!-- @vue-generic {CityProductDetailRow} -->
                <el-table-column
                  v-for="column in cityProductColumns[detailKind]"
                  :key="column.key"
                  :label="column.label"
                  :min-width="column.decimal ? 170 : 150"
                  :align="column.decimal ? 'right' : 'left'"
                >
                  <template #default="scope">{{ displayCell(scope.row, column) || '—' }}</template>
                </el-table-column>
              </el-table>
              <el-pagination
                v-model:current-page="page"
                :page-size="pageSize"
                :total="detailRows.length"
                layout="total, prev, pager, next"
                small
              />
            </el-collapse-item>
            <el-collapse-item title="统计口径" name="definitions">
              <ul class="report-definitions">
                <li v-for="note in businessPreview?.notes ?? []" :key="note">{{ note }}</li>
                <li>已归属回款额包含其中分摊回款，二者不可相加；回款按所选订单累计归属。</li>
                <li>空金额表示未提供；分类和商品是不同观察粒度，不相加。原始单位数量分别统计。</li>
                <li v-for="definition in cityProductMetricDefinitions" :key="definition">
                  {{ definition }}
                </li>
              </ul>
            </el-collapse-item>
          </el-collapse>
        </template>
      </template>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {
  Back,
  Download,
  Filter,
  Refresh,
  RefreshLeft,
  Select,
  Setting,
} from '@element-plus/icons-vue'
import type { EChartsCoreOption } from 'echarts/core'
import {
  getErpProductBrands,
  getErpProductCategories,
  type ErpProductBrandView,
  type ErpProductCategoryView,
} from '@/api/core/erp-internal'
import {
  getErpManagedProducts,
  getErpManagedProduct,
  type ErpManagedProductSummary,
  type ErpManagedProductDetail,
  type ErpManagedProductVariant,
} from '@/api/core/erp-product'
import {
  getCityProductReport,
  type CityProductAllocationMode,
  type CityProductReportQuery,
  type CityProductReportView,
  type ReportDecimal,
} from '@/api/core/bi-city-product-report'
import {
  allocationModeLabels,
  cityProductChartRows,
  cityProductColumns,
  cityProductExportBlockedReason,
  cityProductExportOptions,
  cityProductMetricDefinitions,
  cityProductQuantityNotice,
  cityProductTotals,
  reportCellText,
  reportDecimalText,
  type CityProductColumn,
  type CityProductDetailRow,
  type CityProductExportKind,
} from '../city-product-export'
import { buildCityProductExcel, resolveCityProductColumns } from '../city-product-excel'
import {
  loadReportDictionaries,
  reportMoneyText,
  reportQuantityText,
  reportUnitName as unitName,
} from '../report-format'
import EchartsChart from './EchartsChart.vue'
import CityProductInvestigation from './CityProductInvestigation.vue'
import CityProductSupplyInvestigation from './CityProductSupplyInvestigation.vue'
import { erpCategoryTree, erpCategoryDescendants } from '../erp-category-tree'
import {
  investigationMoney,
  supplyEvidenceBlockedReason,
  type SupplyEvidence,
} from '../city-product-investigation'
import {
  businessTable,
  businessDate,
  businessReportNames,
  type BusinessReportKind,
  type BusinessColumn,
  type BusinessRow,
} from '../business-report'

const props = defineProps<{
  modelValue: boolean
  query: CityProductReportQuery
  productCategories: ErpProductCategoryView[]
  filterOptions?: Partial<
    Record<'region' | 'owner' | 'customerType' | 'source', { label: string; value: string }[]>
  >
}>()
const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()
const categoryId = ref('')
const filtersExpanded = ref(false)
const brandId = ref('')
const productId = ref('')
const skuId = ref('')
const brands = ref<ErpProductBrandView[]>([])
const erpCategories = ref<ErpProductCategoryView[]>([])
const categories = computed(() =>
  erpCategories.value.length ? erpCategories.value : props.productCategories,
)
const categoryTree = computed(() => {
  try {
    return erpCategoryTree(categories.value)
  } catch {
    return []
  }
})
const products = ref<ErpManagedProductSummary[]>([])
const selectedProduct = shallowRef<ErpManagedProductDetail | null>(null)
const dimensionError = ref('')
const productSearchError = ref('')
const productDetailError = ref('')
const dimensionFailure = computed(() =>
  [dimensionError.value, productSearchError.value, productDetailError.value]
    .filter(Boolean)
    .join('；'),
)
const productsLoading = ref(false)
const businessExpanded = ref<string[]>([])
let dimensionSequence = 0
let productsSequence = 0
let productSequence = 0
const draftQuery = ref<CityProductReportQuery>({})
const queryFilters = [
  { key: 'regionCode', options: 'region', label: '城市' },
  { key: 'ownerStaffCode', options: 'owner', label: '销售员工' },
  { key: 'customerTypeCode', options: 'customerType', label: '客户类型' },
  { key: 'sourceSystemCode', options: 'source', label: '来源系统' },
] as const
const dateRange = computed({
  get: () =>
    draftQuery.value.from && draftQuery.value.to
      ? [draftQuery.value.from.slice(0, 10), draftQuery.value.to.slice(0, 10)]
      : null,
  set: (value: string[] | null) => {
    draftQuery.value.from = value?.[0] ? `${value[0]}T00:00:00+08:00` : undefined
    draftQuery.value.to = value?.[1] ? `${value[1]}T23:59:59.999999+08:00` : undefined
  },
})
const reportKind = ref<BusinessReportKind | 'details'>('operating')
const fieldKind = ref<CityProductExportKind | 'business'>('business')
const selectedBusinessColumns = ref<Partial<Record<BusinessReportKind, string[]>>>({})
const activeFieldColumns = computed(() =>
  fieldKind.value === 'business'
    ? (businessPreview.value?.columns ?? [])
    : cityProductColumns[fieldKind.value],
)
const activeSelectedColumns = computed({
  get: () =>
    fieldKind.value === 'business'
      ? reportKind.value === 'details'
        ? []
        : (selectedBusinessColumns.value[reportKind.value] ??
          activeFieldColumns.value.map((column) => column.key))
      : selectedColumns.value[fieldKind.value],
  set: (keys: string[]) => {
    if (fieldKind.value === 'business') {
      if (reportKind.value !== 'details') selectedBusinessColumns.value[reportKind.value] = keys
    } else selectedColumns.value[fieldKind.value] = keys
  },
})
const defaultColumns = () =>
  Object.fromEntries(
    cityProductExportOptions.map((option) => [
      option.value,
      cityProductColumns[option.value].map((column) => column.key),
    ]),
  ) as Record<CityProductExportKind, string[]>
const selectedColumns = ref(defaultColumns())
const selectAllFields = () => {
  activeSelectedColumns.value = activeFieldColumns.value.map((column) => column.key)
}
const resetFields = () => {
  selectedColumns.value = defaultColumns()
  selectedBusinessColumns.value = {}
}
const fieldError = computed(() => {
  try {
    resolveCityProductColumns(selectedColumns.value)
    if (
      reportKind.value !== 'details' &&
      selectedBusinessColumns.value[reportKind.value]?.length === 0
    )
      return '业务汇总至少选择一个导出字段'
    return ''
  } catch (cause) {
    return errorText(cause, '请选择导出字段')
  }
})
const allocationMode = ref<CityProductAllocationMode>('EXACT_ONLY')
const detailKind = ref<CityProductExportKind>('categoryRows')
const report = shallowRef<CityProductReportView | null>(null)
const appliedQuery = shallowRef<CityProductReportQuery | null>(null)
const drillHistory = ref<CityProductReportQuery[]>([])
const supplyEvidence = shallowRef<SupplyEvidence | null>(null)
const includeSupply = ref(true)
const supplyQuery = computed(() => {
  if (!appliedQuery.value) return null
  if (appliedQuery.value.productId) return appliedQuery.value
  if (!appliedQuery.value.skuId) return null
  const products = [
    ...new Set(
      (report.value?.rows ?? [])
        .filter((row) => row.skuId === String(appliedQuery.value!.skuId))
        .map((row) => row.productId)
        .filter(Boolean),
    ),
  ]
  return products.length === 1 ? { ...appliedQuery.value, productId: products[0]! } : null
})
const appliedCategoryName = ref('全部分类')
const error = ref('')
const exportError = ref('')
const exportNotice = ref('')
const exporting = ref(false)
const loading = ref(false)
const expandedDetails = ref<string[]>([])
const page = ref(1)
const pageSize = 100
let requestSequence = 0
let exportSequence = 0

const queryDraft = computed<CityProductReportQuery>(() => {
  const query = {
    ...draftQuery.value,
    productCategoryId: categoryId.value || undefined,
    brandId: brandId.value || undefined,
    productId: productId.value || undefined,
    skuId: skuId.value || undefined,
    allocationMode: allocationMode.value,
  }
  for (const filter of queryFilters) if (!query[filter.key]) query[filter.key] = undefined
  return query
})
const hasDraftChanges = computed(
  () =>
    appliedQuery.value &&
    (
      [
        'from',
        'to',
        'regionCode',
        'ownerStaffCode',
        'customerTypeCode',
        'sourceSystemCode',
        'productCategoryId',
        'brandId',
        'productId',
        'skuId',
        'allocationMode',
      ] as const
    ).some(
      (key) => String(queryDraft.value[key] ?? '') !== String(appliedQuery.value?.[key] ?? ''),
    ),
)
const blockedReason = computed(() => cityProductExportBlockedReason(report.value))
const quantityNotice = computed(() => cityProductQuantityNotice(report.value))
const exportReason = computed(() =>
  loading.value
    ? '正在查询，请等待完整结果'
    : error.value
      ? '查询失败，请重新查询'
      : hasDraftChanges.value
        ? '筛选条件已修改，请先查询后再导出'
        : exporting.value
          ? '正在生成 Excel'
          : (includeSupply.value && supplyEvidence.value?.warehouseId && supplyQuery.value
              ? supplyEvidenceBlockedReason(supplyEvidence.value, supplyQuery.value)
              : '') ||
            fieldError.value ||
            businessError.value ||
            cityProductExportBlockedReason(report.value),
)
const detailRows = computed<CityProductDetailRow[]>(() => report.value?.[detailKind.value] ?? [])
const visibleRows = computed(() =>
  detailRows.value.slice((page.value - 1) * pageSize, page.value * pageSize),
)
const amountGrain = computed(() =>
  reportKind.value === 'operating' ||
  (reportKind.value === 'details' && detailKind.value === 'categoryRows')
    ? 'categoryRows'
    : 'rows',
)
const selectedTotals = computed(() =>
  report.value && !blockedReason.value ? cityProductTotals(report.value, amountGrain.value) : null,
)
const chartRows = computed(() =>
  report.value && !blockedReason.value ? cityProductChartRows(report.value, amountGrain.value) : [],
)
const attributionIncomplete = computed(() => selectedTotals.value?.incomplete ?? false)
const attributionNotice = computed(() => {
  const count =
    amountGrain.value === 'categoryRows'
      ? report.value?.summary?.unallocatedCategoryOrderCount
      : report.value?.summary?.unallocatedOrderCount
  return `${count ? `${count} 笔订单回款待核对；` : '回款尚未全部归属；'}当前商品应收和回款仅含已归属部分，申请订货付款前请核对订单明细。`
})
const money = (value: ReportDecimal) => (value == null ? '—' : investigationMoney(value))
const appliedCityName = computed(() =>
  !appliedQuery.value?.regionCode
    ? '全部城市'
    : props.filterOptions?.region?.find((row) => row.value === appliedQuery.value?.regionCode)
        ?.label ||
      report.value?.rows.find((row) => row.regionCode === appliedQuery.value?.regionCode)
        ?.regionName ||
      '城市名称待补全',
)
const appliedOwnerName = computed(() =>
  !appliedQuery.value?.ownerStaffCode
    ? ''
    : props.filterOptions?.owner?.find((row) => row.value === appliedQuery.value?.ownerStaffCode)
        ?.label ||
      report.value?.orderTrace.find(
        (row) => row.ownerStaffCode === appliedQuery.value?.ownerStaffCode,
      )?.ownerStaffName ||
      '销售姓名待补全',
)
const reportLabels = computed(() => ({
  ...props.filterOptions,
  categories: categories.value,
  brand: brands.value.map((row) => ({ value: String(row.id), label: row.brandName })),
  product: [...products.value, ...(selectedProduct.value ? [selectedProduct.value] : [])].map(
    (row) => ({ value: String(row.id), label: row.productName }),
  ),
  sku: (selectedProduct.value?.variants ?? []).map((row) => ({
    value: String(row.id),
    label: skuLabel(row),
  })),
}))
const appliedProductScope = computed(
  () =>
    ['brandId', 'productId', 'skuId']
      .flatMap((key) => {
        const value = appliedQuery.value?.[key as 'brandId' | 'productId' | 'skuId']
        const options =
          reportLabels.value[key === 'brandId' ? 'brand' : key === 'productId' ? 'product' : 'sku']
        return value
          ? [options.find((row) => row.value === String(value))?.label || '名称待补全']
          : []
      })
      .join(' · ') || '全部商品',
)
const businessResult = computed(() => {
  if (reportKind.value === 'details' || !report.value || blockedReason.value)
    return { table: null, error: '' }
  try {
    return {
      table: businessTable(
        report.value,
        reportKind.value,
        reportLabels.value,
        Boolean(
          appliedQuery.value?.productCategoryId ||
          appliedQuery.value?.brandId ||
          appliedQuery.value?.productId ||
          appliedQuery.value?.skuId,
        ),
      ),
      error: '',
    }
  } catch (cause) {
    return { table: null, error: errorText(cause, '业务汇总暂不可用，请重新查询') }
  }
})
const businessPreview = computed(() => businessResult.value.table)
const businessError = computed(() => businessResult.value.error)
const businessPageNumber = ref(1)
const businessPage = computed(
  () =>
    businessPreview.value?.rows.slice(
      (businessPageNumber.value - 1) * 100,
      businessPageNumber.value * 100,
    ) ?? [],
)
const businessRowClass = ({ row }: { row: BusinessRow }) =>
  row.kind === 'detail' ? '' : 'business-total'
function businessCell(row: BusinessRow, column: BusinessColumn) {
  const value = row.values[column.key]
  if (value == null) return '—'
  if (column.type === 'money') return reportMoneyText(value)
  if (column.type === 'quantity' && /^-?\d+(\.\d+)?$/.test(String(value)))
    return reportQuantityText(value)
  if (column.type === 'percent' && typeof value === 'number') return `${(value * 100).toFixed(2)}%`
  return String(value)
}

const localText = displayDateTime
const displayDate = (value: string) =>
  Number.isFinite(new Date(value).getTime()) ? businessDate(value) : '未提供日期'
const displayTime = (value: string) => localText(value) || '未提供时间'
function displayCell(row: CityProductDetailRow, column: CityProductColumn) {
  return reportCellText(row, column, reportLabels.value)
}

const chartOption = computed<EChartsCoreOption>(() => ({
  color: ['#2878bd', '#238c75'],
  animation: false,
  grid: { left: 74, right: 20, top: 48, bottom: chartRows.value.length > 8 ? 74 : 48 },
  legend: { top: 0, data: ['商品销售额', '已归属回款额'] },
  tooltip: {
    trigger: 'axis',
    renderMode: 'richText',
    confine: true,
    formatter: (params: unknown) => {
      const first = Array.isArray(params) ? params[0] : params
      const index = (first as { dataIndex?: number } | undefined)?.dataIndex
      const row = index == null ? undefined : chartRows.value[index]
      return row
        ? `${row.name}\n商品销售额：${money(row.salesAmount)}\n已归属回款额：${money(row.paidAmount)}${row.incomplete ? '\n回款归属未完整' : ''}`
        : ''
    },
  },
  xAxis: {
    type: 'category',
    data: chartRows.value.map((row) => row.name),
    axisLabel: { interval: 0, width: 70, overflow: 'truncate' },
  },
  yAxis: {
    type: 'value',
    name: '万元',
    axisLabel: { formatter: (value: number) => String(value / 10000) },
  },
  dataZoom:
    chartRows.value.length > 8
      ? [{ type: 'slider', xAxisIndex: 0, startValue: 0, endValue: 7, height: 14, bottom: 8 }]
      : [],
  series: [
    {
      name: '商品销售额',
      type: 'bar',
      barMaxWidth: 28,
      data: chartRows.value.map((row) =>
        row.salesAmount == null ? null : Number(row.salesAmount),
      ),
    },
    {
      name: '已归属回款额',
      type: 'bar',
      barMaxWidth: 28,
      data: chartRows.value.map((row) => (row.paidAmount == null ? null : Number(row.paidAmount))),
    },
  ],
}))

function errorText(value: unknown, fallback: string) {
  return value &&
    typeof value === 'object' &&
    'message' in value &&
    typeof value.message === 'string' &&
    value.message
    ? value.message
    : fallback
}

function skuLabel(sku: ErpManagedProductVariant) {
  return `${sku.specificationSnapshot || '未填写规格'} · ${unitName(sku.unitCode || '')}`
}

async function loadDimensions() {
  const sequence = ++dimensionSequence
  dimensionError.value = ''
  try {
    const categoryRows: ErpProductCategoryView[] = []
    const brandRows: ErpProductBrandView[] = []
    for (let begin = 0; ; begin += 200) {
      const result = await getErpProductCategories({ begin, step: 200 })
      categoryRows.push(...result.items)
      if (categoryRows.length >= result.total) break
      if (!result.items.length || begin >= 9800)
        throw new Error('ERP分类选项未完整加载，请缩小范围后查询ERP档案')
    }
    for (let begin = 0; ; begin += 200) {
      const result = await getErpProductBrands({ begin, step: 200 })
      brandRows.push(...result.items)
      if (brandRows.length >= result.total) break
      if (!result.items.length || begin >= 9800)
        throw new Error('ERP品牌选项未完整加载，请在ERP档案核查')
    }
    if (sequence !== dimensionSequence || !props.modelValue) return
    erpCategoryTree(categoryRows)
    erpCategories.value = categoryRows
    brands.value = brandRows
    void searchProducts('')
  } catch (cause) {
    if (sequence === dimensionSequence && props.modelValue)
      dimensionError.value = errorText(cause, 'ERP品牌和分类暂不可用，请检查权限或服务')
  }
}

async function searchProducts(keyword = '') {
  const sequence = ++productsSequence
  productSearchError.value = ''
  productsLoading.value = true
  try {
    const ids = categoryId.value
      ? erpCategoryDescendants(categories.value, categoryId.value)
      : [undefined]
    if (categoryId.value && !ids.length) throw new Error('ERP分类目录未完整加载，请重试分类选项')
    const result: ErpManagedProductSummary[] = []
    for (const id of ids) {
      const page = await getErpManagedProducts({
        begin: 0,
        step: 50,
        productName: keyword || undefined,
        brandId: brandId.value || undefined,
        categoryId: id,
      })
      result.push(...page.items)
    }
    if (sequence === productsSequence && props.modelValue)
      products.value = [...new Map(result.map((row) => [row.id, row])).values()].slice(0, 50)
  } catch (cause) {
    if (sequence === productsSequence && props.modelValue)
      productSearchError.value = errorText(cause, 'ERP商品选项暂不可用')
  } finally {
    if (sequence === productsSequence) productsLoading.value = false
  }
}

async function loadProduct(id = productId.value) {
  const sequence = ++productSequence
  productDetailError.value = ''
  selectedProduct.value = null
  if (!id) return
  try {
    const result = await getErpManagedProduct(id)
    if (sequence === productSequence && props.modelValue) selectedProduct.value = result
  } catch (cause) {
    if (sequence === productSequence && props.modelValue)
      productDetailError.value = errorText(cause, 'ERP商品规格暂不可用')
  }
}
function changeProductScope() {
  productId.value = ''
  skuId.value = ''
  void loadProduct()
  void searchProducts('')
  void load()
}
function changeProduct() {
  skuId.value = ''
  void loadProduct()
  void load()
}
function investigateProduct(point: {
  regionCode?: string
  brandId?: string
  productId: string
  skuId?: string
}) {
  if (hasDraftChanges.value || !appliedQuery.value || loading.value) return
  drillHistory.value.push({ ...appliedQuery.value })
  draftQuery.value.regionCode = point.regionCode || draftQuery.value.regionCode
  if (point.brandId) brandId.value = point.brandId
  productId.value = point.productId
  skuId.value = point.skuId || ''
  void loadProduct()
  void load()
}
function investigateCity(params: unknown) {
  if (hasDraftChanges.value || !appliedQuery.value || loading.value) return
  const index = (params as { dataIndex?: number }).dataIndex
  const row = index == null ? undefined : chartRows.value[index]
  if (!row?.key || row.key === appliedQuery.value.regionCode) return
  drillHistory.value.push({ ...appliedQuery.value })
  draftQuery.value.regionCode = row.key
  void load()
}
function returnToPrevious() {
  const query = drillHistory.value.pop()
  if (!query) return
  draftQuery.value = { ...query }
  categoryId.value = String(query.productCategoryId ?? '')
  brandId.value = String(query.brandId ?? '')
  productId.value = String(query.productId ?? '')
  skuId.value = String(query.skuId ?? '')
  allocationMode.value = query.allocationMode ?? 'EXACT_ONLY'
  void loadProduct()
  void searchProducts('')
  void load()
}

function invalidate() {
  dimensionSequence += 1
  productsSequence += 1
  productSequence += 1
  requestSequence += 1
  exportSequence += 1
  exporting.value = false
  exportNotice.value = ''
  report.value = null
  appliedQuery.value = null
  loading.value = false
  error.value = ''
  exportError.value = ''
  supplyEvidence.value = null
}

function updateVisible(value: boolean) {
  if (!value) invalidate()
  emit('update:modelValue', value)
}

async function load() {
  if (!props.modelValue) return
  const sequence = ++requestSequence
  const query: CityProductReportQuery = { ...queryDraft.value }
  exportSequence += 1
  exporting.value = false
  exportNotice.value = ''
  loading.value = true
  error.value = ''
  exportError.value = ''
  report.value = null
  supplyEvidence.value = null
  appliedQuery.value = null
  page.value = 1
  try {
    const dictionaries = loadReportDictionaries()
    const result = await getCityProductReport(query)
    await dictionaries
    if (sequence !== requestSequence || !props.modelValue) return
    if (result.allocationMode !== query.allocationMode)
      throw new Error('返回的回款口径与查询不一致，请重试')
    if (!cityProductExportBlockedReason(result)) {
      for (const option of cityProductExportOptions) {
        for (const row of result[option.value]) {
          for (const column of cityProductColumns[option.value])
            if (column.decimal) reportCellText(row, column)
          if ('quantities' in row)
            for (const quantity of row.quantities ?? []) reportDecimalText(quantity.quantity)
        }
      }
      for (const [key, value] of Object.entries(result.summary!)) {
        if (key !== 'quantities' && key !== 'sample') reportDecimalText(value)
      }
      for (const quantity of result.summary!.quantities) reportDecimalText(quantity.quantity)
      for (const row of result.monthlyRows ?? []) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month))
          throw new Error('月度商品数据包含无效月份，请重新核查')
        for (const column of cityProductColumns.rows)
          if (column.decimal) reportCellText(row.metrics, column)
      }
    }
    appliedCategoryName.value = !query.productCategoryId
      ? '全部分类'
      : categories.value.find((row) => String(row.id) === String(query.productCategoryId))
          ?.categoryName ||
        result.categoryRows?.find((row) => row.categoryId === String(query.productCategoryId))
          ?.categoryName ||
        '分类名称待补全'
    appliedQuery.value = query
    selectedBusinessColumns.value = {}
    businessPageNumber.value = 1
    report.value = result
    if (query.skuId && !query.productId && supplyQuery.value?.productId)
      void loadProduct(String(supplyQuery.value.productId))
  } catch (cause) {
    if (sequence === requestSequence && props.modelValue)
      error.value = errorText(cause, '城市商品报表查询失败，请重试')
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

async function downloadExcel() {
  if (exportReason.value || !report.value || !appliedQuery.value) return
  const sequence = ++exportSequence
  const request = requestSequence
  const includedSupply =
    includeSupply.value && supplyEvidence.value?.warehouseId ? supplyEvidence.value : undefined
  exporting.value = true
  exportError.value = ''
  exportNotice.value = ''
  try {
    const { buffer, filename, precisionWarningCount } = await buildCityProductExcel(report.value, {
      query: appliedQuery.value,
      categoryName: appliedCategoryName.value,
      labels: reportLabels.value,
      selectedColumns: Object.fromEntries(
        Object.entries(selectedColumns.value).map(([kind, keys]) => [kind, [...keys]]),
      ),
      businessKind: reportKind.value === 'details' ? undefined : reportKind.value,
      businessColumns:
        reportKind.value === 'details'
          ? undefined
          : selectedBusinessColumns.value[reportKind.value],
      supply: includedSupply,
    })
    if (
      sequence !== exportSequence ||
      request !== requestSequence ||
      !props.modelValue ||
      hasDraftChanges.value ||
      includedSupply !==
        (includeSupply.value && supplyEvidence.value?.warehouseId
          ? supplyEvidence.value
          : undefined)
    )
      return
    const url = URL.createObjectURL(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    )
    const anchor = document.createElement('a')
    try {
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      if (precisionWarningCount)
        exportNotice.value = `${precisionWarningCount} 个单元格超出 Excel 安全精度，已按文本保留；请查看统计口径中的精度警示。`
    } finally {
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  } catch (cause) {
    if (sequence === exportSequence && request === requestSequence && props.modelValue)
      exportError.value = errorText(cause, 'Excel导出失败，请重试')
  } finally {
    if (sequence === exportSequence) exporting.value = false
  }
}

watch(
  () => [props.modelValue, props.query] as const,
  ([opened], previous) => {
    if (!opened) {
      invalidate()
      return
    }
    categoryId.value =
      props.query.productCategoryId == null ? '' : String(props.query.productCategoryId)
    brandId.value = String(props.query.brandId ?? '')
    productId.value = String(props.query.productId ?? '')
    skuId.value = String(props.query.skuId ?? '')
    draftQuery.value = { ...props.query }
    drillHistory.value = []
    // The dashboard supplies calendar dates; reporting interprets those dates in business time.
    if (props.query.from) draftQuery.value.from = `${props.query.from.slice(0, 10)}T00:00:00+08:00`
    if (props.query.to) draftQuery.value.to = `${props.query.to.slice(0, 10)}T23:59:59.999999+08:00`
    if (!previous?.[0]) {
      allocationMode.value = 'EXACT_ONLY'
      detailKind.value = 'categoryRows'
      reportKind.value = 'operating'
      fieldKind.value = 'business'
      expandedDetails.value = []
      resetFields()
      businessExpanded.value = []
      includeSupply.value = true
      void loadDimensions()
    }
    void searchProducts('')
    void loadProduct()
    void load()
  },
  { immediate: true, deep: true },
)
watch(detailKind, () => {
  page.value = 1
  exportError.value = ''
})
watch(reportKind, () => {
  fieldKind.value = reportKind.value === 'details' ? 'categoryRows' : 'business'
  businessPageNumber.value = 1
  exportSequence += 1
  exporting.value = false
})
onBeforeUnmount(invalidate)
</script>

<style scoped lang="scss">
.city-product-report {
  min-width: 0;
  color: #25313c;
}
.report-toolbar {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}
.report-navigation,
.supply-export-option {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.report-field {
  display: grid;
  gap: 6px;
  width: 220px;
  max-width: 100%;
  font-size: 13px;
}
.report-field--mode {
  width: 270px;
}
.report-field--dates {
  width: 380px;
}
.report-field :deep(.el-date-editor) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.report-field-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.report-column-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-height: 360px;
  overflow: auto;
}
.report-column-options :deep(.el-checkbox) {
  margin-right: 8px;
  height: auto;
  min-height: 32px;
  white-space: normal;
}
.report-column-options :deep(.el-checkbox__label) {
  white-space: normal;
  overflow-wrap: anywhere;
}
.report-field-error {
  color: #b42318;
}
.report-field :deep(.el-select) {
  width: 100%;
}
.report-export {
  display: inline-flex;
}
.report-scope {
  color: #617081;
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.report-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  margin: 16px 0;
  gap: 16px;
}
.report-summary div {
  min-width: 0;
}
.report-summary dt {
  color: #617081;
  font-size: 12px;
  margin-bottom: 6px;
}
.report-summary dd {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.report-quantities {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  padding: 12px 0;
  border-top: 1px solid #e5e9ed;
  font-size: 13px;
}
.report-quantity-notice {
  margin: 8px 0 16px;
  color: #735118;
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.report-quantities span {
  overflow-wrap: anywhere;
}
.report-chart {
  min-width: 0;
  margin: 12px 0;
}
.report-chart h3 {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 600;
}
.report-definitions {
  padding-left: 20px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.business-report-preview {
  margin: 18px 0;
  min-width: 0;
}
.business-report-preview h3 {
  font-size: 14px;
  margin: 12px 0;
}
.business-report-preview :deep(.business-total) {
  font-weight: 600;
  --el-table-tr-bg-color: #eef4f8;
}
.city-product-report :deep(.el-alert) {
  margin: 12px 0;
}
.city-product-report :deep(.el-pagination) {
  margin-top: 12px;
  flex-wrap: wrap;
}
.city-product-report :deep(.el-tabs__item) {
  letter-spacing: 0;
}
@media (max-width: 600px) {
  .report-field,
  .report-field--mode {
    width: 100%;
  }
  .report-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .report-summary dd {
    font-size: 16px;
  }
}
</style>
