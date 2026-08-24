<template>
  <div class="crm-dictionary-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">CRM · 客户管理</span>
        <h1>{{ pageConfig.title }}</h1>
        <p>{{ pageConfig.description }}</p>
      </div>
      <div class="heading-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadRows">刷新</el-button>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="search">
        <el-form-item :label="`${pageConfig.shortTitle}名称`">
          <el-input v-model="filters.q" clearable :placeholder="`按${pageConfig.shortTitle}名称或编码查询`" style="width: 260px" />
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
          v-loading="loading"
          class="business-table supply-scroll-table"
          height="100%"
          :data="tableRows"
          row-key="id"
          :tree-props="{ children: 'children' }"
          :default-expand-all="isAreaPage"
        >
          <el-table-column type="index" label="序号" width="80" fixed="left" :index="tableRowIndex" />
          <el-table-column prop="code" :label="`${pageConfig.shortTitle}编码`" min-width="180" show-overflow-tooltip />
          <el-table-column prop="name" :label="`${pageConfig.shortTitle}名称`" min-width="220" show-overflow-tooltip>
            <template #default="scope">
              <div class="record-identity">
                <span class="record-avatar">{{ pageConfig.avatar }}</span>
                <div class="record-identity-content">
                  <strong>{{ scope.row.name }}</strong>
                  <small>{{ scope.row.code }}</small>
                </div>
              </div>
            </template>
          </el-table-column>
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
          <el-table-column label="同步时间" width="180">
            <template #default="scope">{{ formatTime(scope.row.syncedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openCustomers(scope.row)">查看客户</el-button>
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
          :page-sizes="[20, 50, 100, 200]"
          :total="pageData.total"
          @current-change="loadRows"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import {
  getCrmCustomerAreas,
  getCrmCustomerTypes,
  type CrmDictionaryView,
  type CrmPage,
} from '@/api/core/crm'

type DictionaryRow = CrmDictionaryView & { children?: DictionaryRow[] }

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(50)
const pageData = ref<CrmPage<CrmDictionaryView>>({ total: 0, begin: 0, step: 50, items: [] })
const filters = reactive({ q: '' })

const isAreaPage = computed(() => route.meta.routeKey === 'supply.crm.customers.areas')
const pageConfig = computed(() => isAreaPage.value
  ? {
      title: '归属地区',
      shortTitle: '地区',
      avatar: '区',
      description: '查看客户归属地区，作为客户档案和销售订单的地区编码来源。',
    }
  : {
      title: '客户类型',
      shortTitle: '类型',
      avatar: '类',
      description: '查看客户类型，作为客户档案分类、筛选和同步映射的业务主数据。',
    })

const tableRows = computed<DictionaryRow[]>(() => {
  const rows = pageData.value.items as DictionaryRow[]
  if (!isAreaPage.value) return rows
  const byCode = new Map(rows.map((row) => [row.code, { ...row, children: [] as DictionaryRow[] }]))
  const roots: DictionaryRow[] = []
  for (const row of byCode.values()) {
    const parentCode = row.parentCode || ''
    const parent = parentCode ? byCode.get(parentCode) : null
    if (parent) parent.children?.push(row)
    else roots.push(row)
  }
  return roots
})

onMounted(loadRows)

watch(() => route.meta.routeKey, () => {
  currentPage.value = 1
  filters.q = ''
  void loadRows()
})

async function loadRows() {
  loading.value = true
  try {
    const params = {
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      q: filters.q.trim() || undefined,
    }
    pageData.value = isAreaPage.value
      ? await getCrmCustomerAreas(params)
      : await getCrmCustomerTypes(params)
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
  return parent ? `${parent.name}（${parent.code}）` : row.parentCode
}

function openCustomers(row: CrmDictionaryView) {
  void router.push({
    path: '/supply-chain/crm/customers/profiles',
    query: isAreaPage.value ? { regionCode: row.code } : { customerTypeCode: row.code },
  })
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
.crm-dictionary-page {
  min-height: 0;
}
</style>
