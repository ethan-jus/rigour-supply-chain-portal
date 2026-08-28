<template>
  <div class="erp-basic-data-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">ERP · 基础资料</span>
        <h1>{{ pageConfig.title }}</h1>
        <p>{{ pageConfig.description }}</p>
      </div>
      <div class="heading-actions">
        <el-button type="primary" :icon="Plus" @click="openCreate">{{ createButtonLabel }}</el-button>
      </div>
    </div>

    <template v-if="pageKind === 'category'">
      <div v-loading="loading" class="category-workspace">
        <aside class="category-tree-panel">
          <div class="category-panel-header">
            <div>
              <h2>分类树</h2>
              <span>{{ pageData.total }} 个分类</span>
            </div>
            <el-button :icon="Refresh" circle plain aria-label="刷新分类" @click="loadRows" />
          </div>
          <el-input
            v-model="categoryKeyword"
            class="category-search"
            clearable
            placeholder="搜索分类名称/编码"
            :prefix-icon="Search"
          />
          <button
            class="category-tree-root"
            :class="{ 'is-active': !selectedCategoryId }"
            type="button"
            @click="selectAllCategories"
          >
            <span>全部分类</span>
            <strong>{{ categoryRows.length }}</strong>
          </button>
          <el-scrollbar class="category-tree-scroll">
            <el-tree
              v-if="categoryTreeRows.length"
              class="category-tree"
              :data="categoryTreeRows"
              node-key="id"
              :props="{ children: 'children', label: 'categoryName' }"
              :default-expand-all="true"
              :expand-on-click-node="false"
              :current-node-key="selectedCategoryId || undefined"
              highlight-current
              @node-click="selectCategory"
            >
              <template #default="{ data }">
                <div class="category-tree-node">
                  <span class="category-tree-node__name">{{ data.categoryName }}</span>
                  <span v-if="data.children?.length" class="category-tree-node__count">
                    {{ data.children.length }}
                  </span>
                </div>
              </template>
            </el-tree>
            <el-empty v-else description="暂无匹配分类" :image-size="72" />
          </el-scrollbar>
        </aside>

        <main class="category-detail-panel">
          <template v-if="selectedCategory">
            <header class="category-detail-header">
              <div>
                <span>当前分类</span>
                <h2>{{ selectedCategory.categoryName }}</h2>
                <p>{{ categoryPath(selectedCategory) }}</p>
              </div>
              <div class="category-detail-actions">
                <el-button :icon="Plus" @click="openCreateCategoryChild(selectedCategory)">新增子分类</el-button>
                <el-button type="primary" @click="openEdit(selectedCategory)">编辑</el-button>
                <el-button type="danger" plain @click="deleteRow(selectedCategory)">删除</el-button>
              </div>
            </header>
            <div class="category-summary">
              <div>
                <span>上级分类</span>
                <strong>{{ categoryParentName(selectedCategory) }}</strong>
              </div>
              <div>
                <span>直属子类</span>
                <strong>{{ selectedCategoryChildCount }}</strong>
              </div>
              <div>
                <span>全部下级</span>
                <strong>{{ selectedCategoryDescendantCount }}</strong>
              </div>
              <div>
                <span>排序</span>
                <strong>{{ selectedCategory.ordinal ?? '-' }}</strong>
              </div>
            </div>
            <section class="category-section">
              <h3>直属子分类</h3>
              <div v-if="selectedCategoryChildren.length" class="category-child-list">
                <button
                  v-for="child in selectedCategoryChildren"
                  :key="child.id"
                  class="category-child-item"
                  type="button"
                  @click="selectCategory(child)"
                >
                  <span>{{ child.categoryName }}</span>
                  <small>{{ child.children?.length || directCategoryChildCount(child) }} 个子类</small>
                </button>
              </div>
              <el-empty v-else description="暂无子分类" :image-size="56" />
            </section>
            <section class="category-section">
              <h3>系统信息</h3>
              <el-descriptions :column="2" border>
                <el-descriptions-item label="分类编码">{{ selectedCategory.categoryCode || '-' }}</el-descriptions-item>
                <el-descriptions-item label="层级">{{ selectedCategory.categoryLevel || '-' }}</el-descriptions-item>
                <el-descriptions-item label="创建时间">{{ formatTime(selectedCategory.createdTime) }}</el-descriptions-item>
                <el-descriptions-item label="更新时间">{{ formatTime(selectedCategory.updatedTime) }}</el-descriptions-item>
                <el-descriptions-item label="备注" :span="2">{{ selectedCategory.remark || '-' }}</el-descriptions-item>
              </el-descriptions>
            </section>
          </template>
          <template v-else>
            <div class="category-overview">
              <span>分类概览</span>
              <h2>全部商品分类</h2>
              <div class="category-summary">
                <div>
                  <span>一级分类</span>
                  <strong>{{ rootCategoryCount }}</strong>
                </div>
                <div>
                  <span>叶子分类</span>
                  <strong>{{ leafCategoryCount }}</strong>
                </div>
                <div>
                  <span>全部分类</span>
                  <strong>{{ categoryRows.length }}</strong>
                </div>
              </div>
            </div>
          </template>
        </main>
      </div>
    </template>

    <template v-else>
      <el-card class="filter-card" shadow="never">
        <el-form :model="filters" inline @submit.prevent="loadRows">
          <el-form-item :label="`${pageConfig.shortTitle}编号`">
            <el-input v-model="filters.code" clearable placeholder="后端自动生成的编号" style="width: 180px" />
          </el-form-item>
          <el-form-item :label="`${pageConfig.shortTitle}名称`">
            <el-input v-model="filters.name" clearable placeholder="按名称查询" style="width: 220px" />
          </el-form-item>
          <el-form-item v-if="pageKind === 'supplier'" label="联系电话">
            <el-input v-model="filters.contactPhone" clearable placeholder="供应商联系电话" style="width: 180px" />
          </el-form-item>
          <el-form-item v-if="pageKind === 'warehouse'" label="归属地区">
            <el-input v-model="filters.regionCode" clearable placeholder="地区编码" style="width: 150px" />
          </el-form-item>
          <el-form-item v-if="pageKind === 'tag'" label="标签类型">
            <el-input v-model="filters.tagTypeCode" clearable placeholder="标签类型编码" style="width: 150px" />
          </el-form-item>
          <el-form-item v-if="hasStatus" label="状态">
            <el-select v-model="filters.statusCode" clearable placeholder="全部状态" style="width: 130px">
              <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item class="filter-actions">
            <el-button type="primary" :icon="Search" :loading="loading" native-type="submit">查询</el-button>
            <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <div class="result-heading">
        <div>
          <div class="result-title-line">
            <h2>{{ pageConfig.title }}列表</h2>
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
            :data="tableRows"
            row-key="id"
            @row-click="openDetail"
          >
            <el-table-column type="index" label="序号" width="80" fixed="left" :index="tableRowIndex" />
            <el-table-column :label="`${pageConfig.shortTitle}编号`" width="170" show-overflow-tooltip>
              <template #default="scope">{{ rowCode(scope.row) || '-' }}</template>
            </el-table-column>
            <el-table-column :label="`${pageConfig.shortTitle}名称`" min-width="240" show-overflow-tooltip>
              <template #default="scope">
                <span class="record-name">{{ rowName(scope.row) || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column v-if="pageKind === 'tag'" label="标签类型" min-width="160" show-overflow-tooltip>
              <template #default="scope">{{ tagTypeLabel(scope.row) }}</template>
            </el-table-column>
            <el-table-column v-if="pageKind === 'warehouse'" label="归属地区" min-width="150" show-overflow-tooltip>
              <template #default="scope">{{ regionLabel(scope.row) }}</template>
            </el-table-column>
            <el-table-column v-if="pageKind === 'warehouse'" label="仓库类型" min-width="150" show-overflow-tooltip>
              <template #default="scope">{{ warehouseTypeLabel(scope.row) }}</template>
            </el-table-column>
            <el-table-column v-if="pageKind === 'warehouse'" label="默认仓库" width="120" align="center">
              <template #default="scope">
                <el-tag v-if="isDefaultWarehouse(scope.row)" type="success" effect="light">默认</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column v-if="pageKind === 'supplier' || pageKind === 'warehouse'" label="联系人" min-width="130" show-overflow-tooltip>
              <template #default="scope">{{ contactName(scope.row) }}</template>
            </el-table-column>
            <el-table-column v-if="pageKind === 'supplier' || pageKind === 'warehouse'" label="联系电话" min-width="150" show-overflow-tooltip>
              <template #default="scope">{{ contactPhone(scope.row) }}</template>
            </el-table-column>
            <el-table-column v-if="pageKind === 'supplier'" label="开户银行" min-width="160" show-overflow-tooltip>
              <template #default="scope">{{ bankName(scope.row) }}</template>
            </el-table-column>
            <el-table-column v-if="pageKind === 'supplier'" label="银行账号" min-width="150" show-overflow-tooltip>
              <template #default="scope">{{ bankAccountDisplay(bankAccountNo(scope.row)) }}</template>
            </el-table-column>
            <el-table-column v-if="pageKind === 'supplier' || pageKind === 'warehouse'" label="地址" min-width="240" show-overflow-tooltip>
              <template #default="scope">{{ address(scope.row) }}</template>
            </el-table-column>
            <el-table-column v-if="pageKind === 'brand' || pageKind === 'tag'" label="备注" min-width="180" show-overflow-tooltip>
              <template #default="scope">{{ remark(scope.row) }}</template>
            </el-table-column>
            <el-table-column v-if="hasStatus" label="状态" width="110">
              <template #default="scope">
                <el-tag :type="statusTag(rowStatus(scope.row))" effect="light">{{ statusLabel(rowStatus(scope.row)) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="更新时间" width="170">
              <template #default="scope">{{ formatTime(scope.row.updatedTime) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="190" fixed="right" align="center">
              <template #default="scope">
                <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
                <el-button link type="primary" @click.stop="openEdit(scope.row)">编辑</el-button>
                <el-button link type="danger" @click.stop="deleteRow(scope.row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty><el-empty :description="`暂无${pageConfig.shortTitle}`" /></template>
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
    </template>

    <el-drawer
      v-if="pageKind !== 'category'"
      v-model="detailVisible"
      class="erp-basic-detail-drawer"
      size="min(820px, 92vw)"
      :with-header="false"
    >
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>{{ pageConfig.shortTitle }}详情</span>
            <h2>{{ rowName(detail) }}</h2>
            <p>{{ rowCode(detail) || '-' }}</p>
          </div>
          <el-button circle plain :aria-label="`关闭${pageConfig.shortTitle}详情`" @click="detailVisible = false">×</el-button>
        </header>
        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item v-for="item in detailItems(detail)" :key="item.label" :label="item.label" :span="item.span || 1">
              {{ item.value || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      <el-skeleton v-else :rows="8" animated />
    </el-drawer>

    <el-dialog v-model="editorVisible" :title="editingId ? `编辑${pageConfig.shortTitle}` : `新增${pageConfig.shortTitle}`" width="min(760px, 92vw)" destroy-on-close>
      <el-form :model="form" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="`${pageConfig.shortTitle}名称`">
              <el-input v-model="form.name" clearable :placeholder="`请输入${pageConfig.shortTitle}名称`" />
            </el-form-item>
          </el-col>
          <el-col v-if="pageKind === 'category'" :span="12">
            <el-form-item label="上级分类">
              <ProductCategorySelect
                v-model="form.parentId"
                :categories="categorySelectRows"
                :disabled-values="categoryParentDisabledValues"
                :loading="categorySelectLoading"
                placeholder="不选择表示一级分类"
                style="width: 100%"
                @visible-change="handleCategorySelectVisibleChange"
              />
            </el-form-item>
          </el-col>
          <el-col v-if="pageKind === 'category'" :span="12">
            <el-form-item label="排序">
              <el-input-number v-model="form.ordinal" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col v-if="pageKind === 'tag'" :span="12">
            <el-form-item label="标签类型">
              <el-input v-model="form.tagTypeCode" clearable placeholder="如 NEW/HOT/RECOMMEND" />
            </el-form-item>
          </el-col>
          <el-col v-if="pageKind === 'warehouse'" :span="12">
            <el-form-item label="归属地区">
              <el-input v-model="form.regionCode" clearable placeholder="地区编码" />
            </el-form-item>
          </el-col>
          <el-col v-if="pageKind === 'warehouse'" :span="12">
            <el-form-item label="仓库类型">
              <el-input v-model="form.warehouseTypeCode" clearable placeholder="仓库类型编码" />
            </el-form-item>
          </el-col>
          <el-col v-if="pageKind === 'warehouse'" :span="12">
            <el-form-item label="默认仓库">
              <el-switch v-model="form.defaultFlag" active-text="是" inactive-text="否" />
            </el-form-item>
          </el-col>
          <el-col v-if="hasStatus" :span="12">
            <el-form-item label="状态">
              <el-select v-model="form.statusCode" style="width: 100%">
                <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col v-if="pageKind === 'warehouse' || pageKind === 'supplier'" :span="12">
            <el-form-item label="联系人">
              <el-input v-model="form.contactName" clearable />
            </el-form-item>
          </el-col>
          <el-col v-if="pageKind === 'warehouse' || pageKind === 'supplier'" :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.contactPhone" clearable />
            </el-form-item>
          </el-col>
          <el-col v-if="pageKind === 'supplier'" :span="12">
            <el-form-item label="开户银行">
              <el-input v-model="form.bankName" clearable />
            </el-form-item>
          </el-col>
          <el-col v-if="pageKind === 'supplier'" :span="12">
            <el-form-item label="银行账号">
              <el-input v-model="form.bankAccountNo" clearable />
            </el-form-item>
          </el-col>
          <el-col v-if="pageKind === 'warehouse' || pageKind === 'supplier'" :span="24">
            <el-form-item label="地址">
              <el-input v-model="form.address" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="1000" show-word-limit />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRow">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import {
  createErpInventoryWarehouse,
  createErpProductBrand,
  createErpProductCategory,
  createErpProductTag,
  createErpSupplierProfile,
  deleteErpInventoryWarehouse,
  deleteErpProductBrand,
  deleteErpProductCategory,
  deleteErpProductTag,
  deleteErpSupplierProfile,
  getErpInventoryWarehouse,
  getErpInventoryWarehouses,
  getErpProductBrand,
  getErpProductBrands,
  getErpProductCategories,
  getErpProductCategory,
  getErpProductTag,
  getErpProductTags,
  getErpSupplierProfile,
  getErpSupplierProfiles,
  updateErpInventoryWarehouse,
  updateErpProductBrand,
  updateErpProductCategory,
  updateErpProductTag,
  updateErpSupplierProfile,
  type ErpInternalPage,
  type ErpInternalWarehouseCommand,
  type ErpInternalWarehouseView,
  type ErpProductBrandCommand,
  type ErpProductBrandView,
  type ErpProductCategoryCommand,
  type ErpProductCategoryView,
  type ErpProductTagCommand,
  type ErpProductTagView,
  type ErpSupplierProfileCommand,
  type ErpSupplierProfileView,
} from '@/api/core/erp-internal'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'
import ProductCategorySelect from '@/components/supply/ProductCategorySelect.vue'
import { loadAllErpProductCategories } from '@/utils/product-categories'

type PageKind = 'category' | 'brand' | 'tag' | 'warehouse' | 'supplier'
type BasicRow = ErpProductCategoryView | ErpProductBrandView | ErpProductTagView | ErpInternalWarehouseView | ErpSupplierProfileView
type CategoryTreeRow = ErpProductCategoryView & { children?: CategoryTreeRow[]; depth?: number }

const route = useRoute()

const pageConfigs: Record<PageKind, { title: string; shortTitle: string; description: string }> = {
  category: { title: '商品分类', shortTitle: '分类', description: '维护商品分类，用于商品建档、筛选和后续订货展示。' },
  brand: { title: '商品品牌', shortTitle: '品牌', description: '维护商品所属品牌，商品新增和编辑时从这里选择。' },
  tag: { title: '商品标签', shortTitle: '标签', description: '维护新品、推荐、热销等商品标签，商品页只引用标签编码。' },
  warehouse: { title: '仓库信息', shortTitle: '仓库', description: '维护自研 ERP 仓库，销售出库、采购入库和库存调拨都从这里选择仓库。' },
  supplier: { title: '供应商档案', shortTitle: '供应商', description: '维护采购业务使用的供应商档案。' },
}

const pageKind = computed<PageKind>(() => {
  const routeKey = String(route.meta.routeKey || '')
  if (routeKey.includes('attributes.categories')) return 'category'
  if (routeKey.includes('attributes.brands')) return 'brand'
  if (routeKey.includes('attributes.tags')) return 'tag'
  if (routeKey.includes('inventory.warehouses')) return 'warehouse'
  if (routeKey.includes('suppliers.profiles')) return 'supplier'
  return 'category'
})
const pageConfig = computed(() => pageConfigs[pageKind.value])
const createButtonLabel = computed(() => pageKind.value === 'category' ? '新增一级分类' : `新增${pageConfig.value.shortTitle}`)
const hasStatus = computed(() => pageKind.value === 'warehouse' || pageKind.value === 'supplier')
const statusDictionaryCode = computed(() => pageKind.value === 'supplier' ? 'SUPPLIER_STATUS' : 'WAREHOUSE_STATUS')
const statusOptions = computed(() => businessDictionaryOptions('ERP', statusDictionaryCode.value))

const loading = ref(false)
const saving = ref(false)
const detailVisible = ref(false)
const editorVisible = ref(false)
const detail = ref<BasicRow | null>(null)
const editingId = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<ErpInternalPage<BasicRow>>({ total: 0, begin: 0, step: 20, items: [] })
const categorySelectRows = ref<ErpProductCategoryView[]>([])
const categorySelectLoading = ref(false)
const selectedCategoryId = ref<string | null>(null)
const categoryKeyword = ref('')
const tableRows = computed<BasicRow[]>(() => {
  return pageData.value.items
})
const categoryRows = computed(() =>
  pageData.value.items.filter((row): row is ErpProductCategoryView => 'categoryCode' in row),
)
const filteredCategoryRows = computed(() => filterCategoryRows(categoryRows.value, categoryKeyword.value))
const allCategoryTreeRows = computed(() => buildCategoryTree(categoryRows.value))
const categoryTreeRows = computed(() => buildCategoryTree(filteredCategoryRows.value))
const categoryParentDisabledValues = computed(() => disabledCategoryValues(categorySelectRows.value, editingId.value))
const categoryRowMap = computed(() => new Map(categoryRows.value.map((row) => [rowId(row), row])))
const selectedCategory = computed<CategoryTreeRow | null>(() => {
  if (!selectedCategoryId.value) return null
  return findCategoryTreeRow(allCategoryTreeRows.value, selectedCategoryId.value)
})
const selectedCategoryChildren = computed<CategoryTreeRow[]>(() => selectedCategory.value?.children || [])
const selectedCategoryChildCount = computed(() => selectedCategoryChildren.value.length)
const selectedCategoryDescendantCount = computed(() => selectedCategory.value ? categoryDescendantCount(selectedCategory.value) : 0)
const rootCategoryCount = computed(() => categoryRows.value.filter((row) => !row.parentId).length)
const leafCategoryCount = computed(() => categoryRows.value.filter((row) => directCategoryChildCount(row) === 0).length)

const filters = reactive({
  code: '',
  name: '',
  contactPhone: '',
  regionCode: '',
  tagTypeCode: '',
  statusCode: '',
})

const form = reactive({
  name: '',
  parentId: '',
  ordinal: 0,
  tagTypeCode: '',
  regionCode: '',
  warehouseTypeCode: '',
  defaultFlag: false,
  contactName: '',
  contactPhone: '',
  address: '',
  bankName: '',
  bankAccountNo: '',
  statusCode: '',
  remark: '',
  revision: null as number | null,
})

onMounted(() => {
  void loadBusinessDictionaries([
    { moduleCode: 'COMMON', code: 'REGION' },
    { moduleCode: 'ERP', code: 'PRODUCT_TAG_TYPE' },
    { moduleCode: 'ERP', code: 'WAREHOUSE_TYPE' },
    { moduleCode: 'ERP', code: 'WAREHOUSE_STATUS' },
    { moduleCode: 'ERP', code: 'SUPPLIER_STATUS' },
  ])
  void loadRows()
})

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

watch(pageKind, () => {
  selectedCategoryId.value = null
  categoryKeyword.value = ''
  resetFilters()
})

async function loadRows() {
  loading.value = true
  try {
    const common = { begin: (currentPage.value - 1) * pageSize.value, step: pageSize.value }
    if (pageKind.value === 'category') {
      const items = await loadAllErpProductCategories()
      categorySelectRows.value = items
      pageData.value = { total: items.length, begin: 0, step: Math.max(items.length, 1), items }
      ensureCategorySelection()
    } else if (pageKind.value === 'brand') {
      pageData.value = await getErpProductBrands({ ...common, brandCode: empty(filters.code), brandName: empty(filters.name) })
    } else if (pageKind.value === 'tag') {
      pageData.value = await getErpProductTags({ ...common, tagCode: empty(filters.code), tagName: empty(filters.name), tagTypeCode: empty(filters.tagTypeCode) })
    } else if (pageKind.value === 'warehouse') {
      pageData.value = await getErpInventoryWarehouses({
        ...common,
        warehouseCode: empty(filters.code),
        warehouseName: empty(filters.name),
        regionCode: empty(filters.regionCode),
        statusCode: empty(filters.statusCode),
      })
    } else {
      pageData.value = await getErpSupplierProfiles({
        ...common,
        supplierCode: empty(filters.code),
        supplierName: empty(filters.name),
        contactPhone: empty(filters.contactPhone),
        statusCode: empty(filters.statusCode),
      })
    }
  } catch (reason) {
    ElMessage.error(errorMessage(reason, `${pageConfig.value.shortTitle}列表加载失败`))
  } finally {
    loading.value = false
  }
}

async function loadCategorySelectRows() {
  if (pageKind.value !== 'category') return
  categorySelectLoading.value = true
  try {
    categorySelectRows.value = await loadAllErpProductCategories()
  } catch {
    categorySelectRows.value = []
  } finally {
    categorySelectLoading.value = false
  }
}

function handleCategorySelectVisibleChange(visible: boolean) {
  if (visible && pageKind.value === 'category' && !categorySelectRows.value.length && !categorySelectLoading.value) {
    void loadCategorySelectRows()
  }
}

function resetFilters() {
  filters.code = ''
  filters.name = ''
  filters.contactPhone = ''
  filters.regionCode = ''
  filters.tagTypeCode = ''
  filters.statusCode = ''
  categoryKeyword.value = ''
  currentPage.value = 1
  void loadRows()
}

function handleSizeChange() {
  currentPage.value = 1
  void loadRows()
}

async function openDetail(row: BasicRow) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await fetchDetail(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, `${pageConfig.value.shortTitle}详情加载失败`))
  }
}

async function openEdit(row: BasicRow) {
  try {
    const current = await fetchDetail(row.id)
    editingId.value = row.id
    fillForm(current)
    editorVisible.value = true
  } catch (reason) {
    ElMessage.error(errorMessage(reason, `${pageConfig.value.shortTitle}信息加载失败`))
  }
}

function openCreate() {
  editingId.value = null
  resetForm()
  if (pageKind.value === 'category') form.ordinal = nextCategoryOrdinal(null)
  editorVisible.value = true
}

function openCreateCategoryChild(row: ErpProductCategoryView) {
  editingId.value = null
  resetForm()
  form.parentId = rowId(row)
  form.ordinal = nextCategoryOrdinal(rowId(row))
  editorVisible.value = true
}

async function saveRow() {
  if (!form.name.trim()) {
    ElMessage.warning(`请输入${pageConfig.value.shortTitle}名称`)
    return
  }
  saving.value = true
  try {
    const saved = editingId.value ? await updateCurrent(editingId.value) : await createCurrent()
    if (pageKind.value === 'category' && saved && 'categoryCode' in saved) {
      selectedCategoryId.value = rowId(saved)
    }
    ElMessage.success(`${pageConfig.value.shortTitle}已保存`)
    editorVisible.value = false
    await loadRows()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, `${pageConfig.value.shortTitle}保存失败`))
  } finally {
    saving.value = false
  }
}

async function deleteRow(row: BasicRow) {
  if (pageKind.value === 'category' && 'categoryCode' in row && directCategoryChildCount(row) > 0) {
    ElMessage.warning('该分类已有子分类，请先调整或删除子分类')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除${pageConfig.value.shortTitle}「${rowName(row)}」？后端会按规则做逻辑删除。`, `删除${pageConfig.value.shortTitle}`, {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    if (pageKind.value === 'category') await deleteErpProductCategory(row.id, row.revision)
    else if (pageKind.value === 'brand') await deleteErpProductBrand(row.id, row.revision)
    else if (pageKind.value === 'tag') await deleteErpProductTag(row.id, row.revision)
    else if (pageKind.value === 'warehouse') await deleteErpInventoryWarehouse(row.id, row.revision)
    else await deleteErpSupplierProfile(row.id, row.revision)
    ElMessage.success(`${pageConfig.value.shortTitle}已删除`)
    await loadRows()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(errorMessage(reason, `${pageConfig.value.shortTitle}删除失败`))
  }
}

async function fetchDetail(id: string) {
  if (pageKind.value === 'category') return getErpProductCategory(id)
  if (pageKind.value === 'brand') return getErpProductBrand(id)
  if (pageKind.value === 'tag') return getErpProductTag(id)
  if (pageKind.value === 'warehouse') return getErpInventoryWarehouse(id)
  return getErpSupplierProfile(id)
}

async function createCurrent() {
  if (pageKind.value === 'category') return createErpProductCategory(categoryCommand())
  if (pageKind.value === 'brand') return createErpProductBrand(brandCommand())
  if (pageKind.value === 'tag') return createErpProductTag(tagCommand())
  if (pageKind.value === 'warehouse') return createErpInventoryWarehouse(warehouseCommand())
  return createErpSupplierProfile(supplierCommand())
}

async function updateCurrent(id: string) {
  if (pageKind.value === 'category') return updateErpProductCategory(id, categoryCommand())
  if (pageKind.value === 'brand') return updateErpProductBrand(id, brandCommand())
  if (pageKind.value === 'tag') return updateErpProductTag(id, tagCommand())
  if (pageKind.value === 'warehouse') return updateErpInventoryWarehouse(id, warehouseCommand())
  return updateErpSupplierProfile(id, supplierCommand())
}

function categoryCommand(): ErpProductCategoryCommand {
  return { parentId: numberOrNull(form.parentId), categoryName: form.name.trim(), ordinal: form.ordinal, remark: empty(form.remark), revision: form.revision }
}

function brandCommand(): ErpProductBrandCommand {
  return { brandName: form.name.trim(), remark: empty(form.remark), revision: form.revision }
}

function tagCommand(): ErpProductTagCommand {
  return { tagName: form.name.trim(), tagTypeCode: empty(form.tagTypeCode), remark: empty(form.remark), revision: form.revision }
}

function warehouseCommand(): ErpInternalWarehouseCommand {
  return {
    warehouseName: form.name.trim(),
    regionCode: empty(form.regionCode),
    warehouseTypeCode: empty(form.warehouseTypeCode),
    defaultFlag: form.defaultFlag,
    address: empty(form.address),
    contactName: empty(form.contactName),
    contactPhone: empty(form.contactPhone),
    statusCode: empty(form.statusCode),
    remark: empty(form.remark),
    revision: form.revision,
  }
}

function supplierCommand(): ErpSupplierProfileCommand {
  return {
    supplierName: form.name.trim(),
    contactName: empty(form.contactName),
    contactPhone: empty(form.contactPhone),
    address: empty(form.address),
    bankName: empty(form.bankName),
    bankAccountNo: empty(form.bankAccountNo),
    statusCode: empty(form.statusCode),
    remark: empty(form.remark),
    revision: form.revision,
  }
}

function fillForm(row: BasicRow) {
  resetForm()
  form.name = rowName(row)
  form.remark = row.remark || ''
  form.revision = row.revision
  if ('parentId' in row) {
    form.parentId = row.parentId ? String(row.parentId) : ''
    form.ordinal = Number(row.ordinal || 0)
  }
  if ('tagTypeCode' in row) form.tagTypeCode = row.tagTypeCode || ''
  if ('warehouseTypeCode' in row) {
    form.regionCode = row.regionCode || ''
    form.warehouseTypeCode = row.warehouseTypeCode || ''
    form.defaultFlag = Boolean(row.defaultFlag)
    form.contactName = row.contactName || ''
    form.contactPhone = row.contactPhone || ''
    form.address = row.address || ''
    form.statusCode = row.statusCode || ''
  }
  if ('supplierName' in row) {
    form.contactName = row.contactName || ''
    form.contactPhone = row.contactPhone || ''
    form.address = row.address || ''
    form.bankName = row.bankName || ''
    form.bankAccountNo = row.bankAccountNo || ''
    form.statusCode = row.statusCode || ''
  }
}

function resetForm() {
  form.name = ''
  form.parentId = ''
  form.ordinal = 0
  form.tagTypeCode = ''
  form.regionCode = ''
  form.warehouseTypeCode = ''
  form.defaultFlag = false
  form.contactName = ''
  form.contactPhone = ''
  form.address = ''
  form.bankName = ''
  form.bankAccountNo = ''
  form.statusCode = ''
  form.remark = ''
  form.revision = null
}

function rowName(row: BasicRow) {
  if ('categoryName' in row) return row.categoryName
  if ('brandName' in row) return row.brandName
  if ('tagName' in row) return row.tagName
  if ('warehouseName' in row) return row.warehouseName
  return row.supplierName
}

function rowCode(row: BasicRow) {
  if ('categoryCode' in row) return row.categoryCode
  if ('brandCode' in row) return row.brandCode
  if ('tagCode' in row) return row.tagCode
  if ('warehouseCode' in row) return row.warehouseCode
  return row.supplierCode
}

function rowStatus(row: BasicRow) {
  if ('statusCode' in row) return row.statusCode
  return null
}

function categoryParent(row: BasicRow) {
  return 'parentId' in row ? categoryParentName(row) : '-'
}

function categoryLevel(row: BasicRow) {
  return 'categoryLevel' in row ? row.categoryLevel || '-' : '-'
}

function rowOrdinal(row: BasicRow) {
  return 'ordinal' in row ? row.ordinal ?? '-' : '-'
}

function tagTypeLabel(row: BasicRow) {
  return 'tagTypeCode' in row ? businessDictionaryLabel('ERP', 'PRODUCT_TAG_TYPE', row.tagTypeCode, '标签类型') : '-'
}

function regionLabel(row: BasicRow) {
  return 'regionCode' in row ? businessDictionaryLabel('COMMON', 'REGION', row.regionCode, '地区') : '-'
}

function warehouseTypeLabel(row: BasicRow) {
  return 'warehouseTypeCode' in row ? businessDictionaryLabel('ERP', 'WAREHOUSE_TYPE', row.warehouseTypeCode, '仓库类型') : '-'
}

function isDefaultWarehouse(row: BasicRow) {
  return 'defaultFlag' in row ? row.defaultFlag : false
}

function contactName(row: BasicRow) {
  return 'contactName' in row ? row.contactName || '-' : '-'
}

function contactPhone(row: BasicRow) {
  return 'contactPhone' in row ? row.contactPhone || '-' : '-'
}

function bankName(row: BasicRow) {
  return 'bankName' in row ? row.bankName || '-' : '-'
}

function bankAccountNo(row: BasicRow) {
  return 'bankAccountNo' in row ? row.bankAccountNo : null
}

function address(row: BasicRow) {
  return 'address' in row ? row.address || '-' : '-'
}

function remark(row: BasicRow) {
  return row.remark || '-'
}

function bankAccountDisplay(value: string | null | undefined) {
  if (!value) return '-'
  const normalized = value.replace(/\s+/g, '')
  if (normalized.length <= 4) return normalized
  return `尾号 ${normalized.slice(-4)}`
}

function detailItems(row: BasicRow) {
  const base = [
    { label: `${pageConfig.value.shortTitle}编号`, value: rowCode(row) },
    { label: `${pageConfig.value.shortTitle}名称`, value: rowName(row) },
  ]
  if ('parentId' in row) base.push(
    { label: '上级分类', value: categoryParentName(row) },
    { label: '分类层级', value: row.categoryLevel ? String(row.categoryLevel) : '-' },
    { label: '排序', value: row.ordinal !== null ? String(row.ordinal) : '-' },
  )
  if ('tagTypeCode' in row) base.push({ label: '标签类型', value: businessDictionaryLabel('ERP', 'PRODUCT_TAG_TYPE', row.tagTypeCode, '标签类型') })
  if ('warehouseTypeCode' in row) base.push(
    { label: '归属地区', value: businessDictionaryLabel('COMMON', 'REGION', row.regionCode, '地区') },
    { label: '仓库类型', value: businessDictionaryLabel('ERP', 'WAREHOUSE_TYPE', row.warehouseTypeCode, '仓库类型') },
    { label: '默认仓库', value: row.defaultFlag ? '是' : '否' },
    { label: '联系人', value: row.contactName || '-' },
    { label: '联系电话', value: row.contactPhone || '-' },
    { label: '状态', value: statusLabel(row.statusCode) },
    { label: '地址', value: row.address || '-', span: 2 },
  )
  if ('supplierName' in row) base.push(
    { label: '联系人', value: row.contactName || '-' },
    { label: '联系电话', value: row.contactPhone || '-' },
    { label: '开户银行', value: row.bankName || '-' },
    { label: '银行账号', value: row.bankAccountNo || '-' },
    { label: '状态', value: statusLabel(row.statusCode) },
    { label: '地址', value: row.address || '-', span: 2 },
  )
  base.push(
    { label: '备注', value: row.remark || '-', span: 2 },
    { label: '创建人', value: row.createdBy || '-' },
    { label: '创建时间', value: formatTime(row.createdTime) },
    { label: '更新人', value: row.updatedBy || '-' },
    { label: '更新时间', value: formatTime(row.updatedTime) },
  )
  return base
}

function statusLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ERP', statusDictionaryCode.value, value, '状态')
}

function statusTag(value: string | null | undefined) {
  return value === 'ACTIVE' ? 'success' : 'info'
}

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function selectCategory(row: CategoryTreeRow) {
  selectedCategoryId.value = rowId(row)
}

function selectAllCategories() {
  selectedCategoryId.value = null
}

function ensureCategorySelection() {
  if (!selectedCategoryId.value) return
  const exists = categoryRows.value.some((row) => rowId(row) === selectedCategoryId.value)
  if (!exists) selectedCategoryId.value = null
}

function filterCategoryRows(rows: ErpProductCategoryView[], keyword: string) {
  const normalized = normalizeKeyword(keyword)
  if (!normalized) return rows
  const byId = new Map(rows.map((row) => [rowId(row), row]))
  const childrenByParent = categoryChildrenMap(rows)
  const kept = new Set<string>()

  const keepAncestors = (row: ErpProductCategoryView) => {
    let cursor: ErpProductCategoryView | undefined = row
    const visited = new Set<string>()
    while (cursor) {
      const id = rowId(cursor)
      if (visited.has(id)) break
      visited.add(id)
      kept.add(id)
      cursor = cursor.parentId == null ? undefined : byId.get(String(cursor.parentId))
    }
  }
  const keepDescendants = (row: ErpProductCategoryView) => {
    for (const child of childrenByParent.get(rowId(row)) || []) {
      const id = rowId(child)
      if (kept.has(id)) continue
      kept.add(id)
      keepDescendants(child)
    }
  }

  for (const row of rows) {
    if (!categoryMatches(row, normalized)) continue
    keepAncestors(row)
    keepDescendants(row)
  }
  return rows.filter((row) => kept.has(rowId(row)))
}

function categoryMatches(row: ErpProductCategoryView, keyword: string) {
  return normalizeKeyword(row.categoryName).includes(keyword)
    || normalizeKeyword(row.categoryCode).includes(keyword)
}

function normalizeKeyword(value: string | null | undefined) {
  return String(value || '').trim().toLocaleLowerCase('zh-CN')
}

function buildCategoryTree(rows: ErpProductCategoryView[]): CategoryTreeRow[] {
  const nodes = new Map<string, CategoryTreeRow>()
  const roots: CategoryTreeRow[] = []
  for (const row of rows) {
    nodes.set(rowId(row), { ...row, children: [] })
  }
  for (const row of rows) {
    const node = nodes.get(rowId(row))
    if (!node) continue
    const parentId = row.parentId == null ? '' : String(row.parentId)
    const parent = parentId ? nodes.get(parentId) : null
    if (parent && parent !== node) parent.children?.push(node)
    else roots.push(node)
  }
  assignCategoryDepth(roots, 1)
  return sortCategoryTree(roots)
}

function findCategoryTreeRow(rows: CategoryTreeRow[], id: string): CategoryTreeRow | null {
  for (const row of rows) {
    if (rowId(row) === id) return row
    const child = row.children?.length ? findCategoryTreeRow(row.children, id) : null
    if (child) return child
  }
  return null
}

function assignCategoryDepth(rows: CategoryTreeRow[], depth: number) {
  for (const row of rows) {
    row.depth = depth
    if (row.children?.length) assignCategoryDepth(row.children, depth + 1)
  }
}

function sortCategoryTree(rows: CategoryTreeRow[]): CategoryTreeRow[] {
  rows.sort((left, right) =>
    Number(left.ordinal ?? 0) - Number(right.ordinal ?? 0)
    || String(left.categoryCode).localeCompare(String(right.categoryCode), 'zh-CN')
    || Number(left.id) - Number(right.id),
  )
  for (const row of rows) {
    if (row.children?.length) sortCategoryTree(row.children)
    else delete row.children
  }
  return rows
}

function categoryParentName(row: ErpProductCategoryView) {
  if (!row.parentId) return '一级分类'
  const parent = categoryRows.value.find((item) => rowId(item) === String(row.parentId))
  return parent ? parent.categoryName : String(row.parentId)
}

function categoryPath(row: ErpProductCategoryView) {
  const path: string[] = []
  const visited = new Set<string>()
  let cursor: ErpProductCategoryView | undefined = row
  while (cursor) {
    const id = rowId(cursor)
    if (visited.has(id)) break
    visited.add(id)
    path.unshift(cursor.categoryName)
    cursor = cursor.parentId == null ? undefined : categoryRowMap.value.get(String(cursor.parentId))
  }
  return path.join(' / ')
}

function directCategoryChildCount(row: ErpProductCategoryView) {
  const id = rowId(row)
  return categoryRows.value.filter((item) => item.parentId != null && String(item.parentId) === id).length
}

function categoryDescendantCount(row: ErpProductCategoryView) {
  const childrenByParent = categoryChildrenMap(categoryRows.value)
  const walk = (parentId: string): number => {
    const children = childrenByParent.get(parentId) || []
    return children.reduce((total, child) => total + 1 + walk(rowId(child)), 0)
  }
  return walk(rowId(row))
}

function nextCategoryOrdinal(parentId: string | null) {
  const siblings = categoryRows.value.filter((row) => {
    const currentParentId = row.parentId == null ? null : String(row.parentId)
    return currentParentId === parentId
  })
  if (!siblings.length) return 0
  return Math.max(...siblings.map((row) => Number(row.ordinal ?? 0))) + 1
}

function categoryChildrenMap(rows: ErpProductCategoryView[]) {
  const result = new Map<string, ErpProductCategoryView[]>()
  for (const row of rows) {
    if (row.parentId == null) continue
    const parentId = String(row.parentId)
    const children = result.get(parentId) || []
    children.push(row)
    result.set(parentId, children)
  }
  return result
}

function disabledCategoryValues(rows: ErpProductCategoryView[], currentId: string | null) {
  if (!currentId) return []
  const byParent = new Map<string, ErpProductCategoryView[]>()
  for (const row of rows) {
    if (row.parentId == null) continue
    const key = String(row.parentId)
    const children = byParent.get(key) || []
    children.push(row)
    byParent.set(key, children)
  }

  const disabled = new Set<string>([currentId])
  const walk = (parentId: string) => {
    for (const child of byParent.get(parentId) || []) {
      const childId = String(child.id)
      if (disabled.has(childId)) continue
      disabled.add(childId)
      walk(childId)
    }
  }
  walk(currentId)
  return [...disabled]
}

function rowId(row: { id: string | number }) {
  return String(row.id)
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
</script>

<style scoped lang="scss">
.erp-basic-data-page {
  min-height: 0;
}

.category-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  gap: 16px;
  min-height: 520px;
}

.category-tree-panel,
.category-detail-panel {
  min-width: 0;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.category-tree-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.category-panel-header,
.category-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.category-panel-header {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  h2 {
    margin: 0;
    color: var(--el-text-color-primary);
    font-size: 18px;
    line-height: 24px;
  }

  span {
    display: block;
    margin-top: 4px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
}

.category-search {
  box-sizing: border-box;
  width: 100%;
  padding: 12px 16px 0;
}

.category-tree-root {
  display: flex;
  width: calc(100% - 32px);
  align-items: center;
  justify-content: space-between;
  margin: 12px 16px 4px;
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-primary);
  cursor: pointer;

  strong {
    color: var(--el-color-primary);
    font-weight: 600;
  }

  &.is-active,
  &:hover {
    border-color: var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);
  }
}

.category-tree-scroll {
  flex: 1;
  min-height: 360px;
  padding: 8px 10px 12px;
}

.category-tree {
  --el-tree-node-hover-bg-color: var(--el-color-primary-light-9);

  :deep(.el-tree-node__content) {
    height: 38px;
    border-radius: 6px;
  }

  :deep(.el-tree-node.is-current > .el-tree-node__content) {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.category-tree-node {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.category-tree-node__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-tree-node__count {
  flex: 0 0 auto;
  min-width: 22px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

.category-detail-panel {
  padding: 20px;
  overflow: auto;
}

.category-detail-header {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  span,
  p {
    color: var(--el-text-color-secondary);
  }

  span {
    font-size: 13px;
  }

  h2 {
    margin: 6px 0;
    color: var(--el-text-color-primary);
    font-size: 24px;
    line-height: 32px;
  }

  p {
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 14px;
  }
}

.category-detail-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.category-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;

  > div {
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
  }

  span,
  strong {
    display: block;
    min-width: 0;
  }

  span {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  strong {
    margin-top: 6px;
    overflow: hidden;
    color: var(--el-text-color-primary);
    font-size: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.category-section {
  margin-top: 18px;

  h3 {
    margin: 0 0 10px;
    color: var(--el-text-color-primary);
    font-size: 16px;
    line-height: 24px;
  }
}

.category-child-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.category-child-item {
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  text-align: left;
  cursor: pointer;

  span,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: var(--el-text-color-primary);
    font-weight: 600;
  }

  small {
    margin-top: 4px;
    color: var(--el-text-color-secondary);
  }

  &:hover {
    border-color: var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);
  }
}

.category-overview {
  > span {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  h2 {
    margin: 6px 0 0;
    color: var(--el-text-color-primary);
    font-size: 24px;
    line-height: 32px;
  }
}

@media (max-width: 980px) {
  .category-workspace {
    grid-template-columns: 1fr;
  }

  .category-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .category-detail-header {
    display: block;
  }

  .category-detail-actions {
    justify-content: flex-start;
    margin-top: 12px;
  }

  .category-summary {
    grid-template-columns: 1fr;
  }
}
</style>
