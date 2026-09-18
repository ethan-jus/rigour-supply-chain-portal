<template>
  <div class="crm-dictionary-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">CRM · 客户管理</span>
        <SupplyPageTitle>{{ pageConfig.title }}</SupplyPageTitle>
        <p>{{ pageConfig.description }}</p>
      </div>
      <div class="heading-actions">
        <DhbPageSyncButton
          :scope="isAreaPage ? 'AREA' : 'CLIENT_TYPE'"
          :label="pageConfig.shortTitle"
          @completed="loadRows"
        />
        <el-button v-if="isAreaPage" type="primary" @click="openCreateArea"
          >新增地区</el-button
        >
        <el-button :icon="Refresh" :loading="loading" @click="loadRows">刷新</el-button>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="search">
        <el-form-item :label="`${pageConfig.shortTitle}名称`">
          <el-input
            v-model="filters.q"
            clearable
            :placeholder="`按${pageConfig.shortTitle}名称或编码查询`"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :icon="Search" :loading="loading" native-type="submit"
            >查询</el-button
          >
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div v-if="isAreaPage" class="area-toolbar">
      <el-button @click="expandAll">展开全部</el-button>
      <el-button @click="expandedKeys = []">收起全部</el-button>
      <span>按同级显示顺序排列</span>
    </div>

    <div class="result-heading">
      <div>
        <div class="result-title-line">
          <h2>{{ pageConfig.title }}列表</h2>
          <span class="result-count"
            ><strong>{{ pageData.total }}</strong> 条</span
          >
        </div>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          v-loading="loading"
          class="business-table supply-scroll-table"
          height="100%"
          :data="tableRows"
          row-key="id"
          :tree-props="{ children: 'children' }"
          :expand-row-keys="isAreaPage ? effectiveExpandedKeys : undefined"
          :indent="28"
          @expand-change="expansionChanged"
        >
          <el-table-column
            v-if="!isAreaPage"
            type="index"
            label="序号"
            width="80"
            fixed="left"
            :index="tableRowIndex"
          />
          <el-table-column
            prop="name"
            :label="`${pageConfig.shortTitle}名称`"
            min-width="300"
            :fixed="isAreaPage ? 'left' : undefined"
            show-overflow-tooltip
          >
            <template #default="scope">
              <span :class="isAreaPage ? 'area-name' : 'record-name'">{{ scope.row.name || '-' }}</span>
              <span v-if="isAreaPage && scope.row.children?.length" class="area-child-count">{{ scope.row.children.length }} 个直属下级</span>
            </template>
          </el-table-column>
          <el-table-column v-if="isAreaPage" prop="sourceCode" label="订货宝编号" width="125" />
          <el-table-column v-if="isAreaPage" prop="sortOrder" label="显示顺序" width="100" />
          <!-- @vue-generic {CrmDictionaryView} -->
          <el-table-column v-if="isAreaPage" label="上级地区" min-width="180" show-overflow-tooltip>
            <template #default="scope">{{ parentAreaLabel(scope.row) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="120" align="center">
            <template #default="scope">
              <el-tag :type="scope.row.status === 'ACTIVE' ? 'success' : 'info'" effect="light">
                {{ scope.row.status === 'ACTIVE' ? '启用' : scope.row.status || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="!isAreaPage" label="同步时间" width="180">
            <template #default="scope">{{ formatTime(scope.row.syncedAt) }}</template>
          </el-table-column>
          <el-table-column v-if="isAreaPage" label="创建人" min-width="130"><template #default="{ row }">{{ auditActorLabel(row.createdBy) }}</template></el-table-column>
          <el-table-column v-if="isAreaPage" label="创建时间" width="180"><template #default="{ row }">{{ formatTime(row.createdTime) }}</template></el-table-column>
          <el-table-column v-if="isAreaPage" label="修改人" min-width="130"><template #default="{ row }">{{ auditActorLabel(row.updatedBy) }}</template></el-table-column>
          <el-table-column v-if="isAreaPage" label="修改时间" width="180"><template #default="{ row }">{{ formatTime(row.updatedTime) }}</template></el-table-column>
          <!-- @vue-generic {CrmDictionaryView} -->
          <el-table-column label="操作" width="280" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openCustomers(scope.row)"
                >查看客户</el-button
              >
              <el-button v-if="isAreaPage" link type="primary" @click.stop="openChildArea(scope.row)">新增子地区</el-button>
              <el-button v-if="isAreaPage" link type="primary" @click.stop="openEditArea(scope.row)"
                >编辑</el-button
              >
              <el-button v-if="isAreaPage" link type="danger" @click.stop="deleteArea(scope.row)"
                >删除</el-button
              >
            </template>
          </el-table-column>
          <template #empty><el-empty :description="`暂无${pageConfig.shortTitle}`" /></template>
        </el-table>
      </div>
      <div v-if="!isAreaPage" class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100, 200]"
          :total="pageData.total"
          @current-change="loadRows"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="editorVisible"
      :title="editingAreaId ? '编辑地区' : '新增地区'"
      width="min(620px, 92vw)"
      destroy-on-close
    >
      <el-form :model="areaForm" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="areaForm.areaName" clearable placeholder="如 华北地区、西安" />
        </el-form-item>
        <el-form-item label="上级区域">
          <el-tree-select v-model="areaForm.parentAreaCode" :data="parentAreaTree"
            :props="{ label: 'name', children: 'children', disabled: 'disabled' }"
            node-key="code" check-strictly clearable filterable default-expand-all
            placeholder="不选则作为一级地区" style="width: 100%" />
        </el-form-item>
        <el-form-item label="显示顺序"><el-input-number v-model="areaForm.sortOrder" :min="0" :max="999999" :precision="0" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="areaForm.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="INACTIVE" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveArea">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { auditActorLabel } from '@/utils/audit-actor'
import { buildAreaTree, filterAreaTree, areaDescendantCodes } from '@/utils/crm-area-tree'
import { displayDateTime } from '@/utils/business-date'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import DhbPageSyncButton from '@/components/supply/DhbPageSyncButton.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import {
  createCrmCustomerArea,
  deleteCrmCustomerArea,
  getAllCrmCustomerAreas,
  getCrmCustomerTypes,
  updateCrmCustomerArea,
  type CrmCustomerAreaCommand,
  type CrmDictionaryView,
  type CrmPage,
} from '@/api/core/crm'

type DictionaryRow = CrmDictionaryView & { children?: DictionaryRow[] }

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const editorVisible = ref(false)
const editingAreaId = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(50)
const pageData = ref<CrmPage<CrmDictionaryView>>({ total: 0, begin: 0, step: 50, items: [] })
const filters = reactive({ q: '' })
const areaForm = reactive({
  areaName: '',
  parentAreaCode: '',
  status: 'ACTIVE',
  sortOrder: 0,
  revision: null as number | null,
})

const isAreaPage = computed(() => route.meta.routeKey === 'supply.crm.customers.areas')
const pageConfig = computed(() =>
  isAreaPage.value
    ? {
        title: '归属地区',
        shortTitle: '地区',
        description: '查看客户归属地区，作为客户档案和销售订单的地区编码来源。',
      }
    : {
        title: '客户类型',
        shortTitle: '类型',
        description: '查看客户类型，作为客户档案分类、筛选和同步映射的业务主数据。',
      },
)

const expandedKeys = ref<string[]>([])
const areaKeyword = ref('')
const areaTree = computed(() => buildAreaTree(pageData.value.items))
const tableRows = computed<DictionaryRow[]>(() => isAreaPage.value
  ? filterAreaTree(areaTree.value, areaKeyword.value)
  : pageData.value.items)
const effectiveExpandedKeys = computed(() => areaKeyword.value
  ? pageData.value.items.map(row => row.id) : expandedKeys.value)
const parentAreaTree = computed(() => {
  const current = pageData.value.items.find(row => row.id === editingAreaId.value)
  const excluded = current ? areaDescendantCodes(pageData.value.items, current.code) : new Set<string>()
  return buildAreaTree(pageData.value.items.map(row => ({ ...row,
    disabled: excluded.has(row.code) || row.status !== 'ACTIVE',
  })))
})
function expandAll() { expandedKeys.value = pageData.value.items.map(row => row.id) }
function expansionChanged(row: DictionaryRow, expanded: boolean | DictionaryRow[]) {
  if (expanded === true) expandedKeys.value = [...new Set([...expandedKeys.value, row.id])]
  else expandedKeys.value = expandedKeys.value.filter(id => id !== row.id)
}

onMounted(loadRows)

watch(
  () => route.meta.routeKey,
  () => {
    currentPage.value = 1
    filters.q = ''
    areaKeyword.value = ''
    void loadRows()
  },
)

async function loadRows() {
  loading.value = true
  try {
    const params = {
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      q: filters.q.trim() || undefined,
    }
    if (isAreaPage.value) {
      const items = await getAllCrmCustomerAreas()
      pageData.value = { total: items.length, begin: 0, step: items.length, items }
      areaKeyword.value = filters.q.trim()
      expandAll()
    } else pageData.value = await getCrmCustomerTypes(params)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, `${pageConfig.value.title}加载失败`))
  } finally {
    loading.value = false
  }
}

function search() {
  currentPage.value = 1
  void loadRows()
}

function resetFilters() {
  filters.q = ''
  currentPage.value = 1
  void loadRows()
}

function handleSizeChange() {
  currentPage.value = 1
  void loadRows()
}

function tableRowIndex(index: number) {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

function parentAreaLabel(row: CrmDictionaryView) {
  if (!row.parentCode) return '-'
  const parent = pageData.value.items.find((item) => item.code === row.parentCode)
  return parent ? parent.name : '-'
}

function openCustomers(row: CrmDictionaryView) {
  void router.push({
    path: '/supply-chain/crm/customers/profiles',
    query: isAreaPage.value ? { regionCode: row.code } : { customerTypeCode: row.code },
  })
}

function openCreateArea() {
  editingAreaId.value = null
  resetAreaForm()
  editorVisible.value = true
}

function openChildArea(row: CrmDictionaryView) {
  openCreateArea()
  areaForm.parentAreaCode = row.code
}

function openEditArea(row: CrmDictionaryView) {
  editingAreaId.value = row.id
  areaForm.areaName = row.name || ''
  areaForm.parentAreaCode = row.parentCode || ''
  areaForm.sortOrder = row.sortOrder ?? 0
  areaForm.status = row.status || 'ACTIVE'
  areaForm.revision = row.revision ?? null
  editorVisible.value = true
}

async function saveArea() {
  const command = buildAreaCommand()
  if (!command) return
  saving.value = true
  try {
    if (editingAreaId.value) {
      await updateCrmCustomerArea(editingAreaId.value, command)
      ElMessage.success('区域/城市已保存')
    } else {
      await createCrmCustomerArea(command)
      ElMessage.success('区域/城市已新增')
    }
    editorVisible.value = false
    await loadRows()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '区域/城市保存失败'))
  } finally {
    saving.value = false
  }
}

async function deleteArea(row: CrmDictionaryView) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${row.name}」？存在下级或已被客户引用时后端会拒绝删除。`,
      '删除区域/城市',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await deleteCrmCustomerArea(row.id, Number(row.revision ?? 0))
    ElMessage.success('区域/城市已删除')
    await loadRows()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(errorMessage(reason, '区域/城市删除失败'))
  }
}

function buildAreaCommand(): CrmCustomerAreaCommand | null {
  if (!areaForm.areaName.trim()) {
    ElMessage.warning('请输入区域/城市名称')
    return null
  }
  return {
    areaName: areaForm.areaName.trim(),
    parentAreaCode: empty(areaForm.parentAreaCode),
    sortOrder: areaForm.sortOrder,
    status: areaForm.status || 'ACTIVE',
    revision: editingAreaId.value ? areaForm.revision : null,
  }
}

function resetAreaForm() {
  areaForm.areaName = ''
  areaForm.parentAreaCode = ''
  areaForm.sortOrder = 0
  areaForm.status = 'ACTIVE'
  areaForm.revision = null
}

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

const formatTime = displayDateTime

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}
</script>

<style scoped lang="scss">
.area-toolbar { display: flex; align-items: center; gap: 12px; margin: 0 0 12px; color: var(--el-text-color-secondary); }
.area-name { display: inline; font-weight: 500; }
.area-child-count { margin-left: 12px; font-size: 12px; color: var(--el-text-color-secondary); }
.crm-dictionary-page {
  min-height: 0;
}
</style>
