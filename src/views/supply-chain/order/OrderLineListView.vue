<template>
  <div class="order-register-page supply-page supply-page--business-main">
    <OrderRegisterFilterCard :loading="loading" query-first @search="search" @reset="resetFilters">
      <template #actions>
        <el-button plain :loading="exporting" @click="exportCsv">导出</el-button>
        <TableColumnSettings
          plain
          :columns="lineColumns.columns"
          :visibility="lineColumns.visibility"
          @change="lineColumns.setVisible"
          @reset="lineColumns.reset"
        />
      </template>
      <template #primary>
        <el-input v-model="filters.orderNo" aria-label="订单号" clearable placeholder="订单号" style="width: 190px" @keyup.enter="search" />
        <el-input v-model="filters.customerName" aria-label="客户名称" clearable placeholder="客户名称" style="width: 190px" @keyup.enter="search" />
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
          popper-class="order-register-tree-popper"
          style="width: 180px"
        />
        <el-select
          v-model="filters.ownerEmployeeCode"
          aria-label="业务员"
          clearable
          filterable
          remote
          reserve-keyword
          placeholder="搜索业务员"
          :remote-method="searchEmployees"
          :loading="employeeLoading"
          style="width: 150px"
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
          placeholder="选择部门"
          popper-class="order-register-tree-popper"
          style="width: 180px"
        />
        <el-checkbox v-model="filters.includeSubDepartments">含子部门</el-checkbox>
        <el-tree-select
          v-model="pageFilters.categoryId"
          :data="categoryTree"
          :props="categoryTreeProps"
          node-key="id"
          check-strictly
          :render-after-expand="false"
          :loading="categoryLoading"
          aria-label="商品分类"
          clearable
          filterable
          placeholder="商品分类"
          popper-class="order-register-tree-popper"
          style="width: 180px"
          @change="onCategoryChange"
        />
        <el-select
          v-model="pageFilters.productId"
          aria-label="商品"
          clearable
          filterable
          remote
          reserve-keyword
          :remote-method="searchProductOptions"
          :loading="productSearching"
          placeholder="搜索商品名称/编码"
          style="width: 220px"
        >
          <el-option
            v-for="item in productOptions"
            :key="item.id"
            :label="`${item.productName} · ${item.productCode}`"
            :value="String(item.id)"
          />
        </el-select>
        <el-date-picker
          v-model="filters.orderDateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="~"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          aria-label="下单时间"
          style="width: 230px"
        />
      </template>
    </OrderRegisterFilterCard>

    <div class="order-summary" aria-label="明细统计">
      <div class="order-summary__metric">
        <el-tooltip content="逐行「单价×数量」合计，未扣订单折扣与分摊。" placement="top">
          <span class="order-summary__label">明细金额</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ moneyText(pageData.totals.lineAmount) }}</strong>
      </div>
      <div class="order-summary__metric">
        <el-tooltip content="命中订单去重后的折后应收合计；与明细金额的差额来自订单折扣与分摊。" placement="top">
          <span class="order-summary__label">订单金额</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ moneyText(pageData.totals.orderAmount) }}</strong>
      </div>
      <div class="order-summary__metric">
        <el-tooltip
          content="按明细金额占订单应收的比例分摊订单实收；部分回款的订单同样按比例分摊，筛选商品/分类即可看到对应回款。"
          placement="top"
        >
          <span class="order-summary__label">回款金额</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ moneyText(pageData.totals.receivedAmount) }}</strong>
      </div>
      <div class="order-summary__metric">
        <span class="order-summary__label">客户数</span>
        <strong class="order-summary__value">{{ numberText(pageData.totals.customerCount) }}</strong>
      </div>
      <div class="order-summary__metric">
        <el-tooltip content="行数量按来源单位直接合计，不做单位换算。" placement="top">
          <span class="order-summary__label">数量合计</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ numberText(pageData.totals.quantitySum) }}</strong>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          class="business-table supply-scroll-table order-register-table"
          height="100%"
          v-loading="loading"
          :data="pageData.items"
          row-key="id"
          :default-sort="{ prop: 'orderDate', order: 'descending' }"
          @sort-change="changeSort"
        >
          <template #empty>
            <div v-if="loadFailed" class="order-load-failed">
              <span>订单明细加载失败，当前没有可展示的数据。</span>
              <el-button link type="primary" @click="loadLines">重新加载</el-button>
            </div>
            <span v-else>暂无数据</span>
          </template>
          <el-table-column type="index" label="序号" width="70" fixed="left" :index="tableRowIndex" />
          <el-table-column label="明细编码" width="120" fixed="left">
            <template #default="{ row }">
              <el-tooltip content="查看该明细（打开订单商品明细）" placement="top">
                <el-link type="primary" underline="never" @click.stop="openLineDetail(row)">
                  <span class="order-no-cell">{{ row.id }}</span>
                </el-link>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="订单号" width="170" fixed="left" sortable="custom" prop="orderNo">
            <template #default="{ row }">
              <el-link type="primary" underline="never" @click.stop="openDetail(row)">
                <span class="order-no-cell">{{ row.orderNo || '-' }}</span>
              </el-link>
            </template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('customerName')" prop="customerName" label="客户名称" width="190" fixed="left" show-overflow-tooltip>
            <template #default="{ row }">{{ row.customerName || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('regionName')" label="归属地区" width="130">
            <template #default="{ row }">{{ areaLabel(row.regionCode, row.regionName) }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('ownerEmployee')" label="业务员" width="120">
            <template #default="{ row }">{{ employeeLabel(row.ownerEmployeeCode, row.ownerEmployeeName) }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('departmentName')" label="部门" width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ departmentLabel(row.departmentId, row.departmentName) }}</template>
          </el-table-column>
          <el-table-column label="商品" width="240" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="line-product">
                <el-image
                  v-if="productImage(row as OrderRegisterLineItem)"
                  :src="productImage(row as OrderRegisterLineItem)!"
                  fit="cover"
                  lazy
                  class="line-product__image"
                >
                  <template #error>
                    <span class="line-product__image-fallback">图</span>
                  </template>
                </el-image>
                <span v-else class="line-product__image line-product__image--empty">图</span>
                <div class="line-product__text">
                  <span class="line-product__name">{{ row.productName || '商品待补齐' }}</span>
                  <small class="line-product__meta">
                    {{ row.productCode || '无编码' }}
                    <template v-if="row.specification"> · {{ row.specification }}</template>
                  </small>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('skuCode')" prop="skuCode" label="SKU/型号" width="190" show-overflow-tooltip>
            <template #default="{ row }">{{ row.skuCode || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('unitCode')" label="单位" width="80">
            <template #default="{ row }">{{ unitLabel(lineView(row as OrderRegisterLineItem).unitCode) }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('quantity')" label="数量" width="110" align="right">
            <template #default="{ row }">
              <el-tooltip :disabled="!lineView(row as OrderRegisterLineItem).converted" :content="sourceQuantityHint(row as OrderRegisterLineItem)" placement="top">
                <span class="amount amount--strong">{{ numberText(lineView(row as OrderRegisterLineItem).quantity) }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('unitPrice')" label="单价" width="120" align="right">
            <template #default="{ row }">
              <el-tooltip :disabled="!lineView(row as OrderRegisterLineItem).converted" :content="sourceUnitPriceHint(row as OrderRegisterLineItem)" placement="top">
                <span class="amount">{{ moneyText(lineView(row as OrderRegisterLineItem).unitPrice) }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('lineAmount')" label="明细金额" width="130" align="right" sortable="custom" prop="lineAmount">
            <template #default="{ row }">
              <span class="amount amount--muted">{{ moneyText(row.lineAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('orderDate')" label="下单时间" width="170" sortable="custom" prop="orderDate">
            <template #default="{ row }">{{ displayDateTime(row.orderDate) }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('dhbOrderNo')" label="订货宝订单号" width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.dhbOrderNo || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('sourceLineId')" label="来源明细号" width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ row.sourceLineId || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('createdBy')" label="创建人" width="110" show-overflow-tooltip>
            <template #header>
              <el-tooltip content="来源系统真实创建人（取所属订单）；无来源时为本系统记录人。" placement="top">
                <span class="column-header-hint">创建人</span>
              </el-tooltip>
            </template>
            <template #default="{ row }">{{ row.createdBy || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('createdTime')" label="创建时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.createdTime) }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('updatedBy')" label="修改人" width="110" show-overflow-tooltip>
            <template #header>
              <el-tooltip content="来源系统真实修改人（取所属订单）；无来源时为本系统记录人。" placement="top">
                <span class="column-header-hint">修改人</span>
              </el-tooltip>
            </template>
            <template #default="{ row }">{{ row.updatedBy || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('updatedTime')" label="修改时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.updatedTime) }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('syncedBy')" label="同步人" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.syncedBy || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('syncedAt')" label="同步时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.syncedAt) }}</template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="pageData.total"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="onPageSizeChange"
          @current-change="loadLines"
        />
      </div>
    </el-card>

    <OrderRegisterDetailDrawer
      v-model="detailVisible"
      :order-id="detailOrderId"
      :initial-tab="detailTab"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import OrderRegisterDetailDrawer from './components/OrderRegisterDetailDrawer.vue'
import TableColumnSettings from '@/components/supply/TableColumnSettings.vue'
import { displayDateTime } from '@/utils/business-date'
import { moneyText, numberText } from '@/utils/order-register-status'
import { businessDictionaryLabel, loadBusinessDictionaries } from '@/utils/business-dictionary'
import { convertLine, type ConvertedLineQuantity } from '@/utils/product-unit'
import { empty, orderRegisterDateParams } from '@/utils/order-register-query'
import { csvFilename, downloadBlob } from '@/utils/file-download'
import {
  exportOrderRegisterCsv,
  getOrderRegisterLines,
  type OrderRegisterCoverage,
  type OrderRegisterLineItem,
  type OrderRegisterLinePage,
} from '@/api/core/order-register'
import { getErpManagedProducts, type ErpManagedProductSummary } from '@/api/core/erp-product'
import { getErpProductCategories, type ErpProductCategoryView } from '@/api/core/erp-internal'
import { useOrderRegisterCommonFilters } from '@/composables/useOrderRegisterQuery'
import { useOrderRegisterOptions } from '@/composables/useOrderRegisterOptions'
import { useColumnSettings } from '@/composables/useColumnSettings'

const route = useRoute()
const lineColumns = useColumnSettings('order-lines', [
  { key: 'customerName', label: '客户名称' },
  { key: 'regionName', label: '归属地区' },
  { key: 'ownerEmployee', label: '业务员' },
  { key: 'departmentName', label: '部门' },
  { key: 'product', label: '商品', locked: true },
  { key: 'skuCode', label: 'SKU/型号' },
  { key: 'unitCode', label: '单位' },
  { key: 'quantity', label: '数量' },
  { key: 'unitPrice', label: '单价' },
  { key: 'lineAmount', label: '明细金额' },
  { key: 'orderDate', label: '下单时间' },
  { key: 'dhbOrderNo', label: '订货宝订单号' },
  { key: 'sourceLineId', label: '来源明细号' },
  { key: 'createdBy', label: '创建人', defaultVisible: false },
  { key: 'createdTime', label: '创建时间', defaultVisible: false },
  { key: 'updatedBy', label: '修改人', defaultVisible: false },
  { key: 'updatedTime', label: '修改时间', defaultVisible: false },
  { key: 'syncedBy', label: '同步人', defaultVisible: false },
  { key: 'syncedAt', label: '同步时间', defaultVisible: false },
])
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
  departmentLabel,
  employeeLabel,
} = useOrderRegisterOptions()
const { filters, resetCommonFilters } = useOrderRegisterCommonFilters()
const pageFilters = reactive({
  categoryId: '',
  productId: '',
})

const categoryOptions = ref<ErpProductCategoryView[]>([])
const categoryLoading = ref(false)
interface CategoryTreeNode {
  id: string
  categoryName: string
  children: CategoryTreeNode[]
}
const categoryTreeProps = { label: 'categoryName', children: 'children' }
const categoryTree = computed<CategoryTreeNode[]>(() => {
  const nodes = new Map<string, CategoryTreeNode>()
  categoryOptions.value.forEach((row) => {
    nodes.set(String(row.id), { id: String(row.id), categoryName: row.categoryName, children: [] })
  })
  const roots: CategoryTreeNode[] = []
  categoryOptions.value.forEach((row) => {
    const node = nodes.get(String(row.id))
    if (!node) return
    const parent = row.parentId == null ? undefined : nodes.get(String(row.parentId))
    if (parent) parent.children.push(node)
    else roots.push(node)
  })
  return roots
})
const productOptions = ref<ErpManagedProductSummary[]>([])
const productSearching = ref(false)
/** 分类 → 商品ID集合；分类筛选在订单侧只能按商品过滤。 */
const categoryProductCache = new Map<string, number[]>()
const CATEGORY_PRODUCT_LIMIT = 500
/** 当前页商品的 ERP 档案：主图与单位配置。 */
const productInfo = ref(new Map<string, ErpManagedProductSummary>())

const loading = ref(false)
const loadFailed = ref(false)
const exporting = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const sortBy = ref<'orderDate' | 'lineAmount' | 'orderNo'>('orderDate')
const sortDirection = ref<'asc' | 'desc'>('desc')
const pageData = ref<OrderRegisterLinePage>({
  total: 0,
  begin: 0,
  step: 20,
  items: [],
  totals: { lineAmount: 0, receivedAmount: 0, orderAmount: 0, customerCount: 0, productCount: 0, quantitySum: 0 },
  coverage: null,
})

const detailVisible = ref(false)
const detailOrderId = ref<string | number | null>(null)
const detailTab = ref('overview')

function coverageText(coverage: OrderRegisterCoverage | null): string {
  if (!coverage) return ''
  if (coverage.message) return coverage.message
  if (coverage.historyComplete === false) {
    return coverage.coverageFrom
      ? `历史数据仅可从 ${coverage.coverageFrom} 起准确回溯，此前范围不完整。`
      : '历史数据覆盖不完整，明细统计不能视为已确认完整。'
  }
  return ''
}

function notifyCoverage(coverage: OrderRegisterCoverage | null) {
  const message = coverageText(coverage)
  if (!message) return
  ElMessage.warning({ message, showClose: true, duration: 8000, grouping: true })
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}

function unitLabel(code: string | null | undefined) {
  return businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', code, '单位')
}

function productOf(row: OrderRegisterLineItem) {
  return row.productId == null ? undefined : productInfo.value.get(String(row.productId))
}

function lineView(row: OrderRegisterLineItem): ConvertedLineQuantity {
  return convertLine(row, productOf(row))
}

function productImage(row: OrderRegisterLineItem) {
  return productOf(row)?.mainImageUrl || null
}

function sourceQuantityHint(row: OrderRegisterLineItem) {
  return `来源数量：${numberText(row.quantity)} ${unitLabel(row.unitCode)}`
}

function sourceUnitPriceHint(row: OrderRegisterLineItem) {
  return `来源单价：${moneyText(row.unitPrice)} / ${unitLabel(row.unitCode)}`
}

/** 分类筛选先解析成商品集合，再按商品过滤明细。 */
async function loadCategoryProductIds(categoryId: string): Promise<number[]> {
  const ids: number[] = []
  for (let begin = 0; ; begin += 200) {
    const page = await getErpManagedProducts({ begin, step: 200, categoryId })
    ids.push(...page.items.map((item) => Number(item.id)))
    if (ids.length >= page.total || !page.items.length) break
    if (ids.length >= CATEGORY_PRODUCT_LIMIT) break
  }
  if (ids.length > CATEGORY_PRODUCT_LIMIT) ids.length = CATEGORY_PRODUCT_LIMIT
  return ids
}

async function resolveProductIds(): Promise<number[] | undefined> {
  const productId = pageFilters.productId.trim()
  if (productId) return [Number(productId)]
  const categoryId = pageFilters.categoryId.trim()
  if (!categoryId) return undefined
  const cached = categoryProductCache.get(categoryId)
  if (cached) return cached.length ? cached : undefined
  const ids = await loadCategoryProductIds(categoryId)
  categoryProductCache.set(categoryId, ids)
  if (ids.length >= CATEGORY_PRODUCT_LIMIT) {
    ElMessage.warning(`分类下商品超过 ${CATEGORY_PRODUCT_LIMIT} 个，仅按前 ${CATEGORY_PRODUCT_LIMIT} 个商品筛选`)
  }
  return ids.length ? ids : undefined
}

function onCategoryChange() {
  // 商品级联在分类范围内：切换分类后清空已选商品并预载该分类商品。
  pageFilters.productId = ''
  productOptions.value = []
  void searchProductOptions('')
}

async function searchProductOptions(keyword: string) {
  const value = keyword?.trim() || ''
  productSearching.value = true
  try {
    const looksLikeCode = value.length > 0 && !/[\u4e00-\u9fa5]/.test(value)
    const page = await getErpManagedProducts({
      begin: 0,
      step: 20,
      categoryId: empty(pageFilters.categoryId),
      productName: looksLikeCode ? undefined : value || undefined,
      productCode: looksLikeCode ? value : undefined,
    })
    productOptions.value = page.items
  } catch {
    productOptions.value = []
  } finally {
    productSearching.value = false
  }
}

async function buildQuery() {
  const dateParams = orderRegisterDateParams(filters.orderDateRange)
  const productIds = await resolveProductIds()
  return {
    begin: (currentPage.value - 1) * pageSize.value,
    step: pageSize.value,
    orderNo: empty(filters.orderNo),
    customerName: empty(filters.customerName),
    regionCode: empty(filters.regionCode),
    ownerEmployeeCode: empty(filters.ownerEmployeeCode),
    departmentId: filters.departmentId ?? undefined,
    includeSubDepartments: filters.includeSubDepartments,
    productIds,
    sortBy: sortBy.value,
    sortDirection: sortDirection.value,
    ...dateParams,
  }
}

/** 当前页商品主图与单位配置：一次批量核对，失败不阻断列表。 */
async function loadProductInfo() {
  const ids = [
    ...new Set(
      pageData.value.items
        .map((item) => (item.productId == null ? null : Number(item.productId)))
        .filter((id): id is number => id != null && Number.isFinite(id) && id > 0),
    ),
  ]
  if (!ids.length) {
    productInfo.value = new Map()
    return
  }
  try {
    const page = await getErpManagedProducts({ begin: 0, step: 200, productIds: ids })
    productInfo.value = new Map(page.items.map((item) => [String(item.id), item]))
  } catch {
    productInfo.value = new Map()
  }
}

async function loadLines() {
  loading.value = true
  loadFailed.value = false
  try {
    pageData.value = await getOrderRegisterLines(await buildQuery())
    notifyCoverage(pageData.value.coverage)
    void loadProductInfo()
  } catch (reason) {
    loadFailed.value = true
    ElMessage.error({
      message: errorMessage(reason, '订单明细加载失败，请稍后重试'),
      showClose: true,
      grouping: true,
    })
  } finally {
    loading.value = false
  }
}

function search() {
  currentPage.value = 1
  void loadLines()
}

function resetFilters() {
  resetCommonFilters()
  pageFilters.categoryId = ''
  pageFilters.productId = ''
  sortBy.value = 'orderDate'
  sortDirection.value = 'desc'
  search()
}

function onPageSizeChange() {
  currentPage.value = 1
  void loadLines()
}

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

function changeSort({ prop, order }: { prop: string | null; order: string | null }) {
  const allowed = new Set(['orderDate', 'lineAmount', 'orderNo'])
  if (prop && allowed.has(prop)) {
    sortBy.value = prop as typeof sortBy.value
    sortDirection.value = order === 'ascending' ? 'asc' : 'desc'
  } else {
    sortBy.value = 'orderDate'
    sortDirection.value = 'desc'
  }
  search()
}

function openDetail(row: { orderId?: string }) {
  detailTab.value = 'overview'
  detailOrderId.value = row.orderId ?? null
  detailVisible.value = true
}

/** 明细编码入口：直接定位到订单详情的商品明细页签。 */
function openLineDetail(row: { orderId?: string }) {
  detailTab.value = 'lines'
  detailOrderId.value = row.orderId ?? null
  detailVisible.value = true
}

async function exportCsv() {
  exporting.value = true
  try {
    const query = await buildQuery()
    const params: Record<string, unknown> = { ...query }
    delete params.begin
    delete params.step
    const blob = await exportOrderRegisterCsv('lines', params)
    downloadBlob(blob, csvFilename('订单明细'))
  } catch (reason) {
    ElMessage.error({ message: errorMessage(reason, '导出失败，请稍后重试'), showClose: true, grouping: true })
  } finally {
    exporting.value = false
  }
}

async function loadCategoryOptions() {
  categoryLoading.value = true
  try {
    const rows: ErpProductCategoryView[] = []
    for (let begin = 0; ; begin += 200) {
      const page = await getErpProductCategories({ begin, step: 200 })
      rows.push(...page.items)
      if (rows.length >= page.total || !page.items.length || begin >= 9800) break
    }
    categoryOptions.value = rows
  } catch {
    categoryOptions.value = []
  } finally {
    categoryLoading.value = false
  }
}

watch(
  () => route.query.orderNo,
  (value) => {
    if (typeof value === 'string' && value.trim()) {
      filters.orderNo = value.trim()
      search()
    }
  },
  { immediate: true },
)

/** 归属地区变化时清空业务员并按地区级联重载业务员选项。 */
watch(
  () => filters.regionCode,
  (value) => {
    filters.ownerEmployeeCode = ''
    void searchEmployees('', value)
  },
)

onMounted(() => {
  void loadOptions()
  void loadBusinessDictionaries([{ moduleCode: 'COMMON', code: 'PRODUCT_UNIT' }])
  void loadCategoryOptions()
  if (!route.query.orderNo) void loadLines()
})
</script>

<style scoped>
.order-register-page {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

/* 查询区不加卡片外框：条件与操作按钮直接落在页面背景上，留白更宽敞。 */
.supply-page.order-register-page > .filter-card {
  margin-bottom: 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.supply-page.order-register-page > .filter-card :deep(.el-card__body) {
  padding: 0;
}

.order-summary {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  min-height: 60px;
  padding: 14px 20px;
  border: 1px solid var(--supply-border);
  border-bottom: 0;
  border-radius: var(--supply-radius) var(--supply-radius) 0 0;
  background: var(--supply-surface);
}

.order-summary__metric {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 0 28px;
  border-left: 1px solid var(--supply-border);
}

.order-summary__metric:first-child {
  padding-left: 0;
  border-left: 0;
}

.order-summary__label {
  color: var(--supply-text-muted);
  font-size: 13px;
  white-space: nowrap;
}

.order-summary__value {
  font-size: 21px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.order-summary__metric:nth-child(1) .order-summary__value {
  color: #2563eb;
}

.order-summary__metric:nth-child(2) .order-summary__value {
  color: #047857;
}

.order-summary__metric:nth-child(3) .order-summary__value {
  color: #047857;
}

.order-summary__metric:nth-child(4) .order-summary__value {
  color: #d97706;
}

.order-summary__metric:nth-child(5) .order-summary__value {
  color: #64748b;
}

.supply-page.order-register-page > .list-card {
  border-radius: 0 0 var(--supply-radius) var(--supply-radius);
}

.order-register-table :deep(.el-table__header-wrapper tr th.el-table__cell) {
  color: var(--supply-text);
  font-size: 13px;
  font-weight: 700;
}

/* 数量与单价按商品默认统计单位换算展示；金额口径不变。 */
.amount {
  font-variant-numeric: tabular-nums;
}

.amount--muted {
  color: var(--supply-text-muted);
}

.amount--strong {
  color: var(--supply-text);
  font-weight: 600;
}

.line-product {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.line-product__image {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--supply-border);
  border-radius: 6px;
  background: var(--supply-surface-subtle);
  color: var(--supply-text-muted);
  font-size: 11px;
}

.line-product__image-fallback {
  display: inline-flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: var(--supply-text-muted);
  font-size: 11px;
}

.line-product__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.line-product__name {
  overflow: hidden;
  color: var(--supply-text);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-product__meta {
  overflow: hidden;
  color: var(--supply-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-load-failed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-color-danger);
}

.order-no-cell {
  font-weight: 600;
}

@media (max-width: 720px) {
  .order-summary {
    padding: 8px 12px;
  }

  .order-summary__metric {
    padding: 4px 14px 4px 0;
  }
}

.column-header-hint {
  border-bottom: 1px dashed var(--el-border-color);
  cursor: help;
}
</style>
