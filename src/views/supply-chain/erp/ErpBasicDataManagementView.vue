<template>
  <div class="erp-basic-data-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">ERP · 基础资料</span>
        <h1>{{ pageConfig.title }}</h1>
        <p>{{ pageConfig.description }}</p>
      </div>
      <div class="heading-actions">
        <el-button type="primary" @click="openCreate">新增{{ pageConfig.shortTitle }}</el-button>
      </div>
    </div>

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
          <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
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
          :tree-props="{ children: 'children' }"
          :default-expand-all="pageKind === 'category'"
          @row-click="openDetail"
        >
          <el-table-column type="index" label="序号" width="80" fixed="left" :index="tableRowIndex" />
          <el-table-column :label="`${pageConfig.shortTitle}编号`" width="170" show-overflow-tooltip>
            <template #default="scope">{{ rowCode(scope.row) || '-' }}</template>
          </el-table-column>
          <el-table-column :label="`${pageConfig.shortTitle}名称`" min-width="240" show-overflow-tooltip>
            <template #default="scope">
              <div class="record-identity">
                <span class="record-avatar">{{ pageConfig.avatar }}</span>
                <div class="record-identity-content">
                  <strong>{{ rowName(scope.row) }}</strong>
                  <small>{{ rowSubtitle(scope.row) }}</small>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column v-if="pageKind === 'category'" label="上级分类" width="140">
            <template #default="scope">{{ categoryParent(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="pageKind === 'category'" label="层级" width="90" align="center">
            <template #default="scope">{{ categoryLevel(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="pageKind === 'category'" label="排序" width="90" align="center">
            <template #default="scope">{{ rowOrdinal(scope.row) }}</template>
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

    <el-drawer v-model="detailVisible" class="erp-basic-detail-drawer" size="min(820px, 92vw)" :with-header="false">
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
              <el-select v-model="form.parentId" clearable filterable placeholder="不选择表示一级分类" style="width: 100%">
                <el-option
                  v-for="item in categoryParentOptions"
                  :key="item.value"
                  :disabled="item.disabled"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
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

type PageKind = 'category' | 'brand' | 'tag' | 'warehouse' | 'supplier'
type BasicRow = ErpProductCategoryView | ErpProductBrandView | ErpProductTagView | ErpInternalWarehouseView | ErpSupplierProfileView
type CategoryTreeRow = ErpProductCategoryView & { children?: CategoryTreeRow[]; depth?: number }
type CategoryParentOption = { label: string; value: string; disabled: boolean }

const route = useRoute()

const pageConfigs: Record<PageKind, { title: string; shortTitle: string; description: string; avatar: string }> = {
  category: { title: '商品分类', shortTitle: '分类', description: '维护商品分类，用于商品建档、筛选和后续订货展示。', avatar: '类' },
  brand: { title: '商品品牌', shortTitle: '品牌', description: '维护商品所属品牌，商品新增和编辑时从这里选择。', avatar: '牌' },
  tag: { title: '商品标签', shortTitle: '标签', description: '维护新品、推荐、热销等商品标签，商品页只引用标签编码。', avatar: '签' },
  warehouse: { title: '仓库信息', shortTitle: '仓库', description: '维护自研 ERP 仓库，销售出库、采购入库和库存调拨都从这里选择仓库。', avatar: '仓' },
  supplier: { title: '供应商档案', shortTitle: '供应商', description: '维护采购业务使用的供应商档案。', avatar: '供' },
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
const tableRows = computed<BasicRow[]>(() => {
  if (pageKind.value !== 'category') return pageData.value.items
  return buildCategoryTree(categoryRows.value)
})
const categoryRows = computed(() =>
  pageData.value.items.filter((row): row is ErpProductCategoryView => 'categoryCode' in row),
)
const categoryParentOptions = computed<CategoryParentOption[]>(() =>
  flattenCategoryOptions(buildCategoryTree(categoryRows.value), editingId.value),
)

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
  resetFilters()
})

async function loadRows() {
  loading.value = true
  try {
    const common = { begin: (currentPage.value - 1) * pageSize.value, step: pageSize.value }
    if (pageKind.value === 'category') {
      pageData.value = await getErpProductCategories({ ...common, categoryCode: empty(filters.code), categoryName: empty(filters.name) })
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

function resetFilters() {
  filters.code = ''
  filters.name = ''
  filters.contactPhone = ''
  filters.regionCode = ''
  filters.tagTypeCode = ''
  filters.statusCode = ''
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
  editorVisible.value = true
}

async function saveRow() {
  if (!form.name.trim()) {
    ElMessage.warning(`请输入${pageConfig.value.shortTitle}名称`)
    return
  }
  saving.value = true
  try {
    if (editingId.value) await updateCurrent(editingId.value)
    else await createCurrent()
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

function rowSubtitle(row: BasicRow) {
  if ('parentId' in row) return `第 ${categoryLevel(row)} 层`
  if ('tagTypeCode' in row) return businessDictionaryLabel('ERP', 'PRODUCT_TAG_TYPE', row.tagTypeCode, '标签类型')
  if ('warehouseTypeCode' in row) return row.defaultFlag ? '默认仓库' : businessDictionaryLabel('ERP', 'WAREHOUSE_TYPE', row.warehouseTypeCode, '仓库类型')
  if ('supplierName' in row) return row.contactPhone || '供应商资料'
  return row.remark || '商品品牌'
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

function flattenCategoryOptions(rows: CategoryTreeRow[], currentId: string | null) {
  const options: CategoryParentOption[] = []
  const walk = (items: CategoryTreeRow[], parentDisabled: boolean) => {
    for (const item of items) {
      const disabled = parentDisabled || (currentId != null && rowId(item) === currentId)
      options.push({
        label: `${'　'.repeat(Math.max((item.depth || 1) - 1, 0))}${item.categoryName}`,
        value: rowId(item),
        disabled,
      })
      if (item.children?.length) walk(item.children, disabled)
    }
  }
  walk(rows, false)
  return options
}

function categoryParentName(row: ErpProductCategoryView) {
  if (!row.parentId) return '一级分类'
  const parent = categoryRows.value.find((item) => rowId(item) === String(row.parentId))
  return parent ? parent.categoryName : String(row.parentId)
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
</style>
