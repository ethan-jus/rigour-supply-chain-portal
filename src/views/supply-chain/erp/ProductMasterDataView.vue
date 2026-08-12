<template>
  <div class="master-data-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <span>ERP · 商品与主数据</span>
            <h1>{{ page.title }}</h1>
            <p>{{ page.description }}</p>
          </div>
          <el-button
            v-if="canSync"
            type="primary"
            :loading="syncing"
            @click="synchronize"
          >
            同步{{ page.syncLabel }}
          </el-button>
        </div>
      </template>

      <el-alert
        class="boundary-alert"
        type="info"
        :closable="false"
        show-icon
        title="列表只查询 ERP 本地数据；同步由 ERP 编排 Integration 访问订货宝，Portal 不接触 Token、Secret 或订货宝协议。"
      />

      <el-form class="query-bar" inline @submit.prevent="query">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            clearable
            :placeholder="`搜索${page.codeLabel}或名称`"
            @keyup.enter="query"
          />
        </el-form-item>
        <el-form-item label="内部状态">
          <el-select v-model="filters.status" clearable placeholder="全部" style="width: 130px">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="INACTIVE" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="page.viewType === 'PRODUCT' || page.viewType === 'SKU'" label="来源上架">
          <el-select v-model="filters.sourcePutaway" clearable placeholder="全部" style="width: 130px">
            <el-option label="已上架" value="T" />
            <el-option label="已下架" value="F" />
            <el-option label="全部" value="A" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="query">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="data.items" border stripe>
        <el-table-column v-if="page.viewType === 'PRODUCT'" label="主图" width="82" fixed="left">
          <template #default="scope">
            <el-image
              v-if="scope.row.product?.images?.[0]?.url"
              class="product-thumb"
              :src="scope.row.product.images[0].url"
              fit="cover"
              :preview-src-list="scope.row.product.images.map((image) => image.url).filter(Boolean)"
              preview-teleported
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="code" :label="page.codeLabel" min-width="150">
          <template #default="scope">
            <div>{{ valueOrDash(scope.row.code) }}</div>
            <small v-if="page.viewType === 'PRODUCT'" class="cell-secondary">
              来源：{{ valueOrDash(scope.row.sourceId) }}
            </small>
            <small v-if="page.viewType === 'PRODUCT'" class="cell-secondary">
              分类：{{ valueOrDash(scope.row.product?.sourceCategoryId) }} / 品牌：{{ valueOrDash(scope.row.product?.sourceBrandId) }}
            </small>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="220" show-overflow-tooltip>
          <template #default="scope">
            <div class="product-name">{{ scope.row.name }}</div>
            <template v-if="page.viewType === 'PRODUCT'">
              <small v-if="scope.row.product?.model" class="cell-secondary">
                型号：{{ scope.row.product.model }}
              </small>
              <small v-if="scope.row.product?.goodsAllocation" class="cell-secondary">
                货位：{{ scope.row.product.goodsAllocation }}
              </small>
              <small v-if="scope.row.product?.subtitle" class="cell-secondary">
                {{ scope.row.product.subtitle }}
              </small>
              <small v-if="scope.row.product?.sourceMultiId" class="cell-secondary">
                规格维度：{{ scope.row.product.sourceMultiId }}
              </small>
              <small v-if="scope.row.product?.conversionBarcode" class="cell-secondary">
                换算条码：{{ scope.row.product.conversionBarcode }}
              </small>
            </template>
          </template>
        </el-table-column>
        <el-table-column v-if="page.viewType !== 'PRODUCT'" prop="sourceId" label="订货宝来源 ID" min-width="190">
          <template #default="scope">{{ valueOrDash(scope.row.sourceId) }}</template>
        </el-table-column>
        <el-table-column :label="page.attributeLabel" min-width="180">
          <template #default="scope">{{ valueOrDash(scope.row.attribute) }}</template>
        </el-table-column>
        <el-table-column :label="page.detailLabel" min-width="180">
          <template #default="scope">{{ valueOrDash(scope.row.detail) }}</template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'PRODUCT'" label="价格" min-width="150">
          <template #default="scope">
            <div>订货：{{ money(scope.row.product?.orderPrice) }}</div>
            <div class="cell-secondary">市场：{{ money(scope.row.product?.marketPrice) }}</div>
            <div class="cell-secondary">进货：{{ money(scope.row.product?.purchasePrice) }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'PRODUCT'" label="单位 / 起订" min-width="180">
          <template #default="scope">
            <div>基础：{{ valueOrDash(scope.row.product?.unit) }}</div>
            <div v-if="scope.row.product?.middleUnit" class="cell-secondary">
              中：{{ scope.row.product.middleUnit }} × {{ quantity(scope.row.product.baseToMiddleRate) }}
            </div>
            <div v-if="scope.row.product?.bigUnit" class="cell-secondary">
              大：{{ scope.row.product.bigUnit }} × {{ quantity(scope.row.product.baseToBigRate) }}
            </div>
            <div v-if="scope.row.product?.minimumOrder != null" class="cell-secondary">
              起订：{{ quantity(scope.row.product.minimumOrder) }} {{ minimumOrderUnitLabel(scope.row.product.minimumOrderUnit) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'PRODUCT'" label="库存策略" min-width="150">
          <template #default="scope">
            <div>下限：{{ quantity(scope.row.product?.inventoryLower) }}</div>
            <div class="cell-secondary">上限：{{ quantity(scope.row.product?.inventoryUpper) }}</div>
            <div class="cell-secondary">安全：{{ quantity(scope.row.product?.safetyInventory) }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'SKU'" label="价格" min-width="150">
          <template #default="scope">
            <div>订货：{{ money(scope.row.sku?.orderPrice) }}</div>
            <div class="cell-secondary">市场：{{ money(scope.row.sku?.marketPrice) }}</div>
            <div class="cell-secondary">采购：{{ money(scope.row.sku?.purchasePrice) }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'PRODUCT'" label="上下架" width="90">
          <template #default="scope">
            <el-tag :type="putawayTagType(scope.row.product?.sourcePutaway)" effect="plain">
              {{ putawayLabel(scope.row.product?.sourcePutaway) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="内部状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'ACTIVE' ? 'success' : 'info'" effect="plain">
              {{ statusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="page.viewType !== 'PRODUCT'" label="主权" width="130">
          <template #default="scope">{{ ownershipLabel(scope.row.ownershipState) }}</template>
        </el-table-column>
        <el-table-column label="最后同步" min-width="170">
          <template #default="scope">{{ formatTime(scope.row.syncedAt) }}</template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'PRODUCT'" label="操作" width="110" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="openSkuDrawer(scope.row)">查看 SKU</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无本地数据，可点击右上角按当前类型同步" />
        </template>
      </el-table>

      <el-pagination
        class="pagination"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="data.total"
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="[20, 50, 100]"
        @current-change="changeCurrentPage"
        @size-change="changePageSize"
      />
    </el-card>

    <el-drawer v-model="skuDrawerVisible" title="商品 SKU 明细" size="62%">
      <template #default>
        <el-descriptions v-if="selectedProduct" class="sku-summary" :column="2" border>
          <el-descriptions-item label="SPU 编码">{{ valueOrDash(selectedProduct.code) }}</el-descriptions-item>
          <el-descriptions-item label="商品名称">{{ selectedProduct.name }}</el-descriptions-item>
          <el-descriptions-item label="品牌 / 分类">{{ valueOrDash(selectedProduct.product?.brandName) }} / {{ valueOrDash(selectedProduct.product?.categoryName) }}</el-descriptions-item>
          <el-descriptions-item label="来源分类 / 品牌">
            {{ valueOrDash(selectedProduct.product?.sourceCategoryId) }} / {{ valueOrDash(selectedProduct.product?.sourceBrandId) }}
          </el-descriptions-item>
          <el-descriptions-item label="型号">{{ valueOrDash(selectedProduct.product?.model) }}</el-descriptions-item>
          <el-descriptions-item label="货位">{{ valueOrDash(selectedProduct.product?.goodsAllocation) }}</el-descriptions-item>
          <el-descriptions-item label="规格维度">{{ valueOrDash(selectedProduct.product?.sourceMultiId) }}</el-descriptions-item>
          <el-descriptions-item label="换算条码">{{ valueOrDash(selectedProduct.product?.conversionBarcode) }}</el-descriptions-item>
          <el-descriptions-item label="基础订货价">{{ money(selectedProduct.product?.orderPrice) }}</el-descriptions-item>
          <el-descriptions-item label="市场价 / 采购价">
            {{ money(selectedProduct.product?.marketPrice) }} / {{ money(selectedProduct.product?.purchasePrice) }}
          </el-descriptions-item>
          <el-descriptions-item label="中包装 / 大包装">
            {{ valueOrDash(selectedProduct.product?.middleUnit) }} / {{ valueOrDash(selectedProduct.product?.bigUnit) }}
          </el-descriptions-item>
          <el-descriptions-item label="单位换算">
            中 × {{ quantity(selectedProduct.product?.baseToMiddleRate) }} / 大 × {{ quantity(selectedProduct.product?.baseToBigRate) }}
          </el-descriptions-item>
          <el-descriptions-item label="最低订量">
            {{ quantity(selectedProduct.product?.minimumOrder) }} {{ minimumOrderUnitLabel(selectedProduct.product?.minimumOrderUnit) }}
          </el-descriptions-item>
          <el-descriptions-item label="库存下限 / 上限 / 安全库存">
            {{ quantity(selectedProduct.product?.inventoryLower) }} /
            {{ quantity(selectedProduct.product?.inventoryUpper) }} /
            {{ quantity(selectedProduct.product?.safetyInventory) }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="selectedProduct?.product?.images?.some((image) => image.url)" class="product-images">
          <div v-for="image in selectedProduct.product.images.filter((item) => item.url)" :key="image.id" class="product-image-card">
            <el-image
              class="product-image"
              :src="image.url || undefined"
              :alt="image.originalName || image.sourceFileName || undefined"
              fit="cover"
              :preview-src-list="selectedProduct.product.images.map((item) => item.url).filter(Boolean)"
              preview-teleported
            />
            <small class="cell-secondary">{{ valueOrDash(image.originalName || image.sourceFileName) }}</small>
          </div>
        </div>

        <el-table v-loading="skuLoading" :data="skuItems" border stripe>
          <el-table-column prop="sourceSkuId" label="订货宝SKU ID" min-width="150" />
          <el-table-column prop="skuCode" label="SKU 编码" min-width="150" />
          <el-table-column prop="optionsId" label="规格组合ID" min-width="130" />
          <el-table-column prop="specificationSummary" label="规格组合" min-width="180">
            <template #default="scope">{{ valueOrDash(scope.row.specificationSummary) }}</template>
          </el-table-column>
          <el-table-column prop="barcode" label="条码" min-width="150">
            <template #default="scope">{{ valueOrDash(scope.row.barcode) }}</template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="90">
            <template #default="scope">{{ valueOrDash(scope.row.unit) }}</template>
          </el-table-column>
          <el-table-column prop="firstSpecificationValueSourceId" label="第一规格值ID" min-width="140" />
          <el-table-column prop="secondSpecificationValueSourceId" label="第二规格值ID" min-width="140" />
          <el-table-column label="订货价" width="110">
            <template #default="scope">{{ money(scope.row.orderPrice) }}</template>
          </el-table-column>
          <el-table-column label="中 / 大包装价" width="140">
            <template #default="scope">
              {{ money(scope.row.middleOrderPrice) }} / {{ money(scope.row.bigOrderPrice) }}
            </template>
          </el-table-column>
          <el-table-column label="市场 / 采购价" width="140">
            <template #default="scope">{{ money(scope.row.marketPrice) }} / {{ money(scope.row.purchasePrice) }}</template>
          </el-table-column>
          <el-table-column label="内部状态" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.internalStatus === 'ACTIVE' ? 'success' : 'info'" effect="plain">
                {{ statusLabel(scope.row.internalStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="该 SPU 暂无已落库 SKU" />
          </template>
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  getErpBrands,
  getErpCategories,
  getErpProducts,
  getErpSkus,
  getErpSpecifications,
  getErpTags,
  syncErpData,
  type ErpBrandView,
  type ErpCategoryView,
  type ErpMasterDataObjectType,
  type ErpPage,
  type ErpProductView,
  type ErpSkuView,
  type ErpSpecificationView,
  type ErpTagView,
} from '@/api'
import { useAuthStore } from '@/stores/auth'

interface PageDefinition {
  routeKey: string
  viewType: 'PRODUCT' | 'SKU' | 'CATEGORY' | 'BRAND' | 'SPECIFICATION' | 'TAG'
  objectType: ErpMasterDataObjectType
  title: string
  syncLabel: string
  description: string
  codeLabel: string
  attributeLabel: string
  detailLabel: string
}

interface DisplayRow {
  id: string
  sourceId: string | null
  code: string | null
  name: string
  attribute: string | null
  detail: string | null
  status: string
  ownershipState: string
  syncedAt: string | null
  product?: ErpProductView
  sku?: ErpSkuView
}

const pageDefinitions: PageDefinition[] = [
  {
    routeKey: 'supply.erp.master-data.products',
    viewType: 'PRODUCT', objectType: 'PRODUCT_SPU', title: '商品/SPU', syncLabel: '商品',
    description: '管理 ERP 本地商品模型及订货宝来源关系。', codeLabel: 'SPU 编码',
    attributeLabel: '品牌 / 分类', detailLabel: '条码 / 单位 / SKU',
  },
  {
    routeKey: 'supply.erp.master-data.skus',
    viewType: 'SKU', objectType: 'PRODUCT_SPU', title: 'SKU', syncLabel: '商品与SKU',
    description: '查询随商品主数据同步落库的 SKU；页面只查询 ERP 本地数据。', codeLabel: 'SKU 编码',
    attributeLabel: '规格组合', detailLabel: '条码 / 单位 / 规格组合ID',
  },
  {
    routeKey: 'supply.erp.master-data.attributes.categories',
    viewType: 'CATEGORY', objectType: 'CATEGORY', title: '分类', syncLabel: '分类',
    description: '管理商品分类档案；订货宝 getSite 结果作为一期来源。', codeLabel: '分类编码',
    attributeLabel: '层级', detailLabel: '父分类 ID',
  },
  {
    routeKey: 'supply.erp.master-data.attributes.brands',
    viewType: 'BRAND', objectType: 'BRAND', title: '品牌', syncLabel: '品牌',
    description: '管理 ERP 品牌档案与订货宝品牌来源绑定。', codeLabel: '品牌编码',
    attributeLabel: '数据来源', detailLabel: '备注',
  },
  {
    routeKey: 'supply.erp.master-data.attributes.specifications',
    viewType: 'SPECIFICATION', objectType: 'SPECIFICATION', title: '规格与包装', syncLabel: '规格与包装',
    description: '管理规格项与规格值；一期由 getMultiOptionsList 同步落库。', codeLabel: '规格编码',
    attributeLabel: '规格值数', detailLabel: '数据来源',
  },
  {
    routeKey: 'supply.erp.master-data.attributes.tags',
    viewType: 'TAG', objectType: 'TAG', title: '商品标签', syncLabel: '标签',
    description: '管理商品标签；一期由 getGoodsTag 同步落库。', codeLabel: '标签编码',
    attributeLabel: '颜色', detailLabel: '数据来源',
  },
]

const route = useRoute()
const auth = useAuthStore()
const page = computed(() => pageDefinitions.find((item) => item.routeKey === route.meta.routeKey)
  ?? pageDefinitions[0])
const canSync = computed(() => auth.hasPermission('erp:product:write'))
const loading = ref(false)
const syncing = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', status: '', sourcePutaway: '' })
const data = ref<ErpPage<DisplayRow>>({ total: 0, begin: 0, step: 20, items: [] })
const skuDrawerVisible = ref(false)
const skuLoading = ref(false)
const skuItems = ref<ErpSkuView[]>([])
const selectedProduct = ref<DisplayRow | null>(null)

onMounted(load)
watch(() => route.meta.routeKey, async () => {
  currentPage.value = 1
  filters.keyword = ''
  filters.status = ''
  filters.sourcePutaway = ''
  await load()
})

async function load() {
  loading.value = true
  const params = {
    begin: (currentPage.value - 1) * pageSize.value,
    step: pageSize.value,
    q: filters.keyword.trim() || undefined,
    status: filters.status || undefined,
  }
  try {
    if (page.value.viewType === 'PRODUCT') {
      const result = await getErpProducts({
        ...params,
        internalStatus: params.status,
        status: undefined,
        sourcePutaway: filters.sourcePutaway && filters.sourcePutaway !== 'A'
          ? filters.sourcePutaway : undefined,
      })
      data.value = mapPage(result, mapProduct)
    } else if (page.value.viewType === 'SKU') {
      const result = await getErpSkus({
        ...params,
        sourcePutaway: filters.sourcePutaway && filters.sourcePutaway !== 'A'
          ? filters.sourcePutaway : undefined,
      })
      data.value = mapPage(result, mapSku)
    } else if (page.value.viewType === 'CATEGORY') {
      data.value = mapPage(await getErpCategories(params), mapCategory)
    } else if (page.value.viewType === 'BRAND') {
      data.value = mapPage(await getErpBrands(params), mapBrand)
    } else if (page.value.viewType === 'SPECIFICATION') {
      data.value = mapPage(await getErpSpecifications(params), mapSpecification)
    } else {
      data.value = mapPage(await getErpTags(params), mapTag)
    }
  } catch (reason) {
    data.value = { total: 0, begin: params.begin, step: params.step, items: [] }
    ElMessage.error(errorMessage(reason, `${page.value.title}加载失败`))
  } finally {
    loading.value = false
  }
}

async function openSkuDrawer(product: DisplayRow) {
  selectedProduct.value = product
  skuItems.value = []
  skuDrawerVisible.value = true
  if (!product.code) {
    ElMessage.warning('当前商品缺少 SPU 编码，无法查询 SKU')
    return
  }

  skuLoading.value = true
  try {
    const result = await getErpSkus({ begin: 0, step: 1000, q: product.code })
    skuItems.value = result.items.filter((item) => item.spuCode === product.code)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, 'SKU 明细加载失败'))
  } finally {
    skuLoading.value = false
  }
}

async function synchronize() {
  syncing.value = true
  try {
    const result = await syncErpData(page.value.objectType)
    ElMessage.success(
      `${page.value.syncLabel}同步完成：获取${result.fetched}条，新增${result.created}条，变更${result.changed}条`,
    )
    await load()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, `${page.value.syncLabel}同步失败`))
  } finally {
    syncing.value = false
  }
}

async function query() {
  currentPage.value = 1
  await load()
}

async function resetFilters() {
  filters.keyword = ''
  filters.status = ''
  filters.sourcePutaway = ''
  await query()
}

async function changeCurrentPage(value: number) {
  currentPage.value = value
  await load()
}

async function changePageSize(value: number) {
  pageSize.value = value
  currentPage.value = 1
  await load()
}

function mapPage<T>(source: ErpPage<T>, mapper: (item: T) => DisplayRow): ErpPage<DisplayRow> {
  return { ...source, items: source.items.map(mapper) }
}

function mapProduct(item: ErpProductView): DisplayRow {
  return {
    id: item.id, sourceId: item.sourceProductId, code: item.spuCode, name: item.name,
    attribute: [item.brandName, item.categoryName].filter(Boolean).join(' / ') || null,
    detail: [item.barcode, item.unit, item.conversionBarcode, `SKU ${item.skuCount}`].filter(Boolean).join(' / '),
    status: item.internalStatus, ownershipState: item.ownershipState, syncedAt: item.syncedAt,
    product: item,
  }
}

function mapSku(item: ErpSkuView): DisplayRow {
  return {
    id: item.id, sourceId: item.sourceSkuId, code: item.skuCode, name: item.productName,
    attribute: item.specificationSummary || null,
    detail: [item.barcode, item.unit, item.optionsId].filter(Boolean).join(' / ') || null,
    status: item.internalStatus, ownershipState: item.ownershipState, syncedAt: item.syncedAt,
    sku: item,
  }
}

function mapCategory(item: ErpCategoryView): DisplayRow {
  return {
    id: item.id, sourceId: item.sourceCategoryId, code: item.categoryCode, name: item.name,
    attribute: `第 ${item.categoryLevel} 级${item.sourceDefaultFlag ? ' / 默认' : ''}`,
    detail: [item.parentId, item.sourceCategoryNumber, item.externalReferenceId].filter(Boolean).join(' / ') || null,
    status: item.status, ownershipState: item.ownershipState, syncedAt: item.syncedAt,
  }
}

function mapBrand(item: ErpBrandView): DisplayRow {
  return {
    id: item.id, sourceId: item.sourceBrandId, code: item.brandCode, name: item.name,
    attribute: [item.sourceBrandNumber, item.externalReferenceId].filter(Boolean).join(' / ') || '订货宝',
    detail: item.sourceDescription || null,
    status: item.status, ownershipState: item.ownershipState, syncedAt: item.syncedAt,
  }
}

function mapSpecification(item: ErpSpecificationView): DisplayRow {
  return {
    id: item.id, sourceId: item.sourceSpecificationId, code: item.specificationCode, name: item.name,
    attribute: `${item.valueCount} 个规格值`,
    detail: [item.sourceParentId, item.values.map((value) => value.valueName).join('、')].filter(Boolean).join(' / ') || '订货宝',
    status: item.status, ownershipState: item.ownershipState, syncedAt: item.syncedAt,
  }
}

function mapTag(item: ErpTagView): DisplayRow {
  return {
    id: item.id, sourceId: item.sourceTagId, code: item.tagCode, name: item.name,
    attribute: item.sourceGroupName || item.color, detail: item.sourceRelationCount == null
      ? '订货宝' : `关联 ${item.sourceRelationCount}`,
    status: item.status, ownershipState: item.ownershipState, syncedAt: item.syncedAt,
  }
}

function statusLabel(status: string) {
  if (status === 'ACTIVE') return '启用'
  if (status === 'INACTIVE') return '停用'
  return status || '-'
}

function ownershipLabel(value: string) {
  if (value === 'EXTERNAL_PRIMARY') return '外部主数据'
  if (value === 'INTERNAL_PRIMARY') return '内部主数据'
  if (value === 'INTERNAL_OVERRIDDEN') return '本地已覆盖'
  return valueOrDash(value)
}

function valueOrDash(value: unknown) {
  return value === null || value === undefined || value === '' ? '-' : String(value)
}

function money(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : `¥${Number(value).toFixed(2)}`
}

function quantity(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toString() : String(value)
}

function minimumOrderUnitLabel(value: string | null | undefined) {
  if (value === 'base_units') return '基础单位'
  if (value === 'middle_units') return '中包装'
  if (value === 'container_units') return '大包装'
  return valueOrDash(value)
}

function putawayLabel(value: string | null | undefined) {
  if (value === 'T') return '上架'
  if (value === 'F') return '下架'
  return valueOrDash(value)
}

function putawayTagType(value: string | null | undefined) {
  if (value === 'T') return 'success'
  if (value === 'F') return 'info'
  return 'warning'
}

function formatTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function errorMessage(reason: unknown, fallback: string) {
  if (typeof reason === 'object' && reason !== null && 'message' in reason) {
    const message = (reason as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}
</script>

<style scoped lang="scss">
.master-data-page { padding-bottom: 20px; }

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;

  span { color: #64748b; font-size: 13px; }
  h1 { margin: 5px 0; font-size: 22px; color: #0f172a; }
  p { margin: 0; color: #64748b; }
}

.boundary-alert { margin-bottom: 18px; }
.query-bar { margin-bottom: 2px; }
.pagination { justify-content: flex-end; margin-top: 20px; }
.sku-summary { margin-bottom: 18px; }
.product-thumb { width: 48px; height: 48px; border-radius: 6px; }
.product-name { font-weight: 600; color: #0f172a; }
.cell-secondary { display: block; margin-top: 3px; color: #64748b; line-height: 1.35; }
.product-images { display: flex; flex-wrap: wrap; gap: 12px; margin: 0 0 18px; }
.product-image-card { width: 86px; }
.product-image { width: 86px; height: 86px; border-radius: 8px; border: 1px solid #e2e8f0; }

@media (max-width: 720px) {
  .page-header { flex-direction: column; }
  .query-bar :deep(.el-form-item) { width: 100%; margin-right: 0; }
  .query-bar :deep(.el-input), .query-bar :deep(.el-select) { width: 100% !important; }
}
</style>
