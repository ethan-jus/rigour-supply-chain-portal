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
        <el-date-picker
          v-model="filters.orderDateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="~"
          start-placeholder="订单开始日期"
          end-placeholder="订单结束日期"
          aria-label="下单时间"
          style="width: 280px"
        />
        <el-input v-model="filters.orderNo" aria-label="订单号" clearable placeholder="订单号" style="width: 190px" @keyup.enter="search" />
        <el-input v-model="filters.customerName" aria-label="客户名称" clearable placeholder="客户名称" style="width: 190px" @keyup.enter="search" />
        <el-tree-select
          v-model="filters.regionCode"
          v-clear-filter-on-empty-input="() => (filters.regionCode = '')"
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
          v-clear-filter-on-empty-input="() => (filters.ownerEmployeeCode = '')"
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
          v-clear-filter-on-empty-input="() => (filters.departmentId = null)"
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
          v-clear-filter-on-empty-input="() => (pageFilters.categoryId = '')"
          :data="categoryTree"
          :props="categoryTreeProps"
          node-key="id"
          check-strictly
          :render-after-expand="false"
          :loading="categoryLoading"
          :no-data-text="categoryLoadFailed ? '分类加载失败，请重新展开重试' : '暂无商品分类'"
          @visible-change="onCategoryVisibleChange"
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
          v-clear-filter-on-empty-input="() => (pageFilters.productId = '')"
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
        <el-select v-model="pageFilters.discountStatus" aria-label="优惠情况" clearable placeholder="优惠情况" style="width: 130px">
          <el-option label="全部" value="" />
          <el-option label="有优惠" value="true" />
          <el-option label="无优惠" value="false" />
        </el-select>
        <el-select v-model="pageFilters.paymentStatusCode" aria-label="收款状态" clearable placeholder="收款状态" style="width: 130px">
          <el-option label="未收款" value="UNPAID" />
          <el-option label="部分收款" value="PARTIAL_PAID" />
          <el-option label="已收款" value="PAID" />
        </el-select>
      </template>
    </OrderRegisterFilterCard>

    <el-alert v-if="pageData.totals.missingLineOrderCount" :closable="false" type="warning"
      :title="`当前筛选有 ${pageData.totals.missingLineOrderCount} 笔订单缺少明细，订货金额、优惠额及优惠率暂无法完整计算。`" />
    <el-alert v-if="pageData.totals.unallocatableOrderCount" :closable="false" type="warning"
      :title="`${pageData.totals.unallocatableOrderCount} 笔订单订货金额为零但存在财务金额，无法按商品比例分摊，相关统计暂不展示。`" />
    <p v-if="pageFilters.productId || pageFilters.categoryId" class="order-summary-note">已筛选商品：优惠、应收、已收及待收按商品订货金额占整单的比例分摊，分币尾差已计入。</p>
    <div class="order-summary order-summary--lines" aria-label="明细统计">
      <div class="order-summary__metric order-summary__metric--ordered">
        <el-tooltip content="筛选命中的有效明细单价×数量合计。" placement="top">
          <span class="order-summary__label">订货金额</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ moneyText(pageData.totals.lineAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--payable">
        <el-tooltip content="商品条件下按明细订货金额占整单比例分摊实际应收；未筛选商品时与订单列表一致。" placement="top">
          <span class="order-summary__label">订单金额</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ moneyText(pageData.totals.orderAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--discount">
        <el-tooltip content="订货金额减对应实际应收；商品条件下为分摊后的优惠额。" placement="top">
          <span class="order-summary__label">优惠额</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ moneyText(pageData.totals.discountAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--discount">
        <el-tooltip content="当前范围优惠额合计÷订货金额合计；不是各订单优惠率平均值。" placement="top">
          <span class="order-summary__label">优惠率</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ discountRateText(pageData.totals.discountRate) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--paid">
        <el-tooltip content="订单账本已收金额（含历史期初），商品条件下按订货金额比例分摊。" placement="top">
          <span class="order-summary__label">回款金额</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ moneyText(pageData.totals.receivedAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--paid">
        <el-tooltip content="当前筛选范围回款金额合计÷订单金额合计；订单金额为零时不计算。" placement="top">
          <span class="order-summary__label">回款率</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ repaymentRateText(pageData.totals.receivedAmount, pageData.totals.orderAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--unpaid">
        <el-tooltip content="订单账本未收余额，商品条件下按订货金额比例分摊。" placement="top">
          <span class="order-summary__label">待收金额</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ moneyText(pageData.totals.unpaidAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--count">
        <el-tooltip content="当前查询条件下全部有效明细的销售数量合计，按明细交易单位累加，不按商品或SKU去重。" placement="top">
          <span class="order-summary__label">商品数</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ numberText(pageData.totals.quantitySum) }}</strong>
      </div>
    </div>

    <el-alert v-if="productInfoFailed" type="warning" :closable="false" show-icon>
      商品图片与单位信息加载失败
      <el-button link type="primary" @click="loadProductInfo">重新加载商品信息</el-button>
    </el-alert>
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
          <el-table-column v-if="lineColumns.isVisible('lineAmount')" label="订货金额" width="130" align="right" sortable="custom" prop="lineAmount">
            <template #default="{ row }">
              <span class="amount amount--muted">{{ moneyText(row.lineAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('orderAmount')" label="订单金额（分摊后）" width="175" align="right">
            <template #header>
              <el-tooltip content="整单实际应收按本明细订货金额比例分摊。" placement="top"><span>订单金额（分摊后）</span></el-tooltip>
            </template>
            <template #default="{ row }"><span class="amount amount--strong">{{ moneyText(row.orderAmount) }}</span></template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('discountAmount')" label="优惠额" width="130" align="right" sortable="custom" prop="discountAmount">
            <template #header>
              <el-tooltip content="明细订货金额减分摊订单金额，包含整单优惠分摊，不代表来源单独对该商品打折。" placement="top"><span>优惠额</span></el-tooltip>
            </template>
            <template #default="{ row }"><span class="amount line-discount-amount">{{ moneyText(row.discountAmount) }}</span></template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('discountRate')" label="优惠率" width="115" align="right" sortable="custom" prop="discountRate">
            <template #header>
              <el-tooltip content="分摊优惠额÷明细订货金额；订货金额为零时不计算。" placement="top"><span>优惠率</span></el-tooltip>
            </template>
            <template #default="{ row }"><span class="line-discount-amount">{{ discountRateText(row.discountRate) }}</span></template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('paymentStatus')" label="收款状态" width="110">
            <template #default="{ row }">
              <el-tag class="order-status-tag" :type="orderPaymentStatusTag(row.paymentStatusCode)" effect="light">
                {{ row.paymentStatusCode === 'UNPAID' ? '未收款' : orderPaymentStatusLabel(row.paymentStatusCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="lineColumns.isVisible('orderDate')" label="下单时间" width="170" sortable="custom" prop="orderDate">
            <template #default="{ row }">{{ displayDateTime(row.orderDate) }}</template>
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
import { moneyText, numberText, repaymentRateText, orderPaymentStatusLabel, orderPaymentStatusTag } from '@/utils/order-register-status'
import { businessDictionaryLabel, loadBusinessDictionaries } from '@/utils/business-dictionary'
import { convertLine, type ConvertedLineQuantity } from '@/utils/product-unit'
import { empty, orderRegisterDateParams } from '@/utils/order-register-query'
import { csvFilename, downloadBlob } from '@/utils/file-download'
import { vClearFilterOnEmptyInput } from '@/utils/filter-select-clear'
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
  { key: 'lineAmount', label: '订货金额' },
  { key: 'orderAmount', label: '订单金额（分摊后）' },
  { key: 'discountAmount', label: '优惠额' },
  { key: 'discountRate', label: '优惠率' },
  { key: 'paymentStatus', label: '收款状态' },
  { key: 'orderDate', label: '下单时间' },
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
  discountStatus: '' as string | undefined,
  paymentStatusCode: '' as string | undefined,
  categoryId: '' as string | undefined,
  productId: '' as string | undefined,
})

const categoryOptions = ref<ErpProductCategoryView[]>([])
const categoryLoading = ref(false)
const categoryLoadFailed = ref(false)
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
const productInfoFailed = ref(false)
let productInfoRequest = 0
const productInfo = ref(new Map<string, ErpManagedProductSummary>())

const loading = ref(false)
const loadFailed = ref(false)
const exporting = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const sortBy = ref<'orderDate' | 'lineAmount' | 'orderNo' | 'discountAmount' | 'discountRate'>('orderDate')
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

function discountRateText(value: number | null | undefined): string {
  return value == null ? '-' : `${(value * 100).toFixed(2)}%`
}

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
  const categories = new Set([categoryId])
  for (const id of categories) {
    categoryOptions.value.forEach(row => {
      if (row.parentId != null && String(row.parentId) === id) categories.add(String(row.id))
    })
  }
  const ids = new Set<number>()
  for (const id of categories) {
    for (let begin = 0; ; begin += 200) {
      const page = await getErpManagedProducts({ begin, step: 200, categoryId: id })
      page.items.forEach(item => ids.add(Number(item.id)))
      if (page.total > CATEGORY_PRODUCT_LIMIT || ids.size > CATEGORY_PRODUCT_LIMIT) {
        throw new Error(`分类下商品超过 ${CATEGORY_PRODUCT_LIMIT} 个，请缩小分类范围后查询，避免统计不完整`)
      }
      if (begin + page.items.length >= page.total || !page.items.length) break
    }
  }
  return [...ids]
}

async function resolveProductIds(): Promise<number[] | undefined> {
  // 下拉清除后可能是 undefined，这里统一按空处理，避免清空条件时报错导致列表停在旧数据。
  const productId = empty(pageFilters.productId)
  if (productId) return [Number(productId)]
  const categoryId = empty(pageFilters.categoryId)
  if (!categoryId) return undefined
  const cached = categoryProductCache.get(categoryId)
  if (cached) return cached
  const ids = await loadCategoryProductIds(categoryId)
  categoryProductCache.set(categoryId, ids)
  return ids
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
    paymentStatusCode: empty(pageFilters.paymentStatusCode),
    hasDiscount: empty(pageFilters.discountStatus) == null ? undefined : pageFilters.discountStatus === 'true',
    sortBy: sortBy.value,
    sortDirection: sortDirection.value,
    ...dateParams,
  }
}

/** 当前页商品主图与单位配置：一次批量核对，失败不阻断列表。 */
async function loadProductInfo() {
  const request = ++productInfoRequest
  productInfoFailed.value = false
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
    if (request !== productInfoRequest) return
    productInfo.value = new Map(page.items.map((item) => [String(item.id), item]))
  } catch {
    if (request === productInfoRequest) productInfoFailed.value = true
  }
}

async function loadLines() {
  loading.value = true
  loadFailed.value = false
  try {
    const query = await buildQuery()
    pageData.value = query.productIds?.length === 0
      ? { total: 0, begin: query.begin, step: query.step, items: [], coverage: null,
          totals: { lineAmount: 0, orderAmount: 0, discountAmount: 0, receivedAmount: 0, unpaidAmount: 0, productCount: 0, quantitySum: 0 } }
      : await getOrderRegisterLines(query)
    notifyCoverage(pageData.value.coverage)
    void loadProductInfo()
  } catch (reason) {
    loadFailed.value = true
    pageData.value = { total: 0, begin: 0, step: pageSize.value, items: [], totals: {}, coverage: null }
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
  pageFilters.discountStatus = ''
  pageFilters.paymentStatusCode = ''
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
  const allowed = new Set(['orderDate', 'lineAmount', 'orderNo', 'discountAmount', 'discountRate'])
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
    if (query.productIds?.length === 0) {
      ElMessage.info('当前分类没有商品，无可导出明细')
      return
    }
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

function onCategoryVisibleChange(visible: boolean) {
  if (visible && (categoryLoadFailed.value || !categoryOptions.value.length)) void loadCategoryOptions()
}

async function loadCategoryOptions() {
  if (categoryLoading.value) return
  categoryLoading.value = true
  categoryLoadFailed.value = false
  try {
    const rows: ErpProductCategoryView[] = []
    for (let begin = 0; ; begin += 200) {
      const page = await getErpProductCategories({ begin, step: 200 })
      rows.push(...page.items)
      if (rows.length >= page.total || !page.items.length || begin >= 9800) break
    }
    categoryOptions.value = rows
    categoryProductCache.clear()
  } catch {
    categoryLoadFailed.value = true
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
.line-discount-amount { color: #7c3aed; font-variant-numeric: tabular-nums; }
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



.column-header-hint {
  border-bottom: 1px dashed var(--el-border-color);
  cursor: help;
}
</style>

<style scoped src="./order-summary.css"></style>

<style scoped src="./order-status.css"></style>
