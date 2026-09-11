<template>
  <div class="crm-shipping-address-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">CRM · 客户管理</span>
        <h1>客户地址</h1>
        <p>查看客户收货地址簿，地址来源于 CRM 本地表，不在页面实时访问订货宝。</p>
      </div>
      <div class="heading-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadRows">刷新</el-button>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="search">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.q"
            clearable
            placeholder="客户、收货人、电话或地址"
            style="width: 280px"
          />
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
          <h2>客户地址列表</h2>
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
          :data="pageData.items"
          row-key="id"
        >
          <el-table-column type="index" label="序号" width="80" fixed="left" :index="tableRowIndex" />
          <el-table-column prop="customerName" label="客户名称" min-width="220" show-overflow-tooltip>
            <template #default="scope">
              <span class="record-name">{{ scope.row.customerName || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="consignee" label="收货人" min-width="130" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.consignee || scope.row.contact || '-' }}</template>
          </el-table-column>
          <el-table-column prop="phone" label="联系电话" min-width="150" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.phone || '-' }}</template>
          </el-table-column>
          <el-table-column prop="areaName" label="地区" min-width="160" show-overflow-tooltip>
            <template #default="scope">{{ areaLabel(scope.row) }}</template>
          </el-table-column>
          <el-table-column prop="fullAddress" label="详细地址" min-width="300" show-overflow-tooltip>
            <template #default="scope">{{ addressLabel(scope.row) }}</template>
          </el-table-column>
          <el-table-column label="默认地址" width="110" align="center">
            <template #default="scope">
              <el-tag v-if="scope.row.defaultAddress" type="success" effect="light">默认</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="来源状态" width="130" align="center">
            <template #default="scope">
              <el-tag :type="sourcePresenceTag(scope.row.sourcePresence)" effect="light">
                {{ sourcePresenceLabel(scope.row.sourcePresence) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="同步时间" width="180">
            <template #default="scope">{{ formatTime(scope.row.syncedAt || scope.row.sourceUpdatedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openCustomer(scope.row)">查看客户</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无客户地址" /></template>
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import {
  getCrmShippingAddresses,
  type CrmPage,
  type ShippingAddressSummaryView,
} from '@/api/core/crm'

const router = useRouter()
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<CrmPage<ShippingAddressSummaryView>>({ total: 0, begin: 0, step: 20, items: [] })
const filters = reactive({ q: '' })

onMounted(loadRows)

async function loadRows() {
  loading.value = true
  try {
    pageData.value = await getCrmShippingAddresses({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      q: filters.q.trim() || undefined,
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '客户地址加载失败'))
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

function areaLabel(row: ShippingAddressSummaryView) {
  return [row.regionText, row.areaName].filter(Boolean).join(' / ') || '-'
}

function addressLabel(row: ShippingAddressSummaryView) {
  return row.fullAddress || [row.regionText, row.areaName, row.addressDetail].filter(Boolean).join('') || '-'
}

function openCustomer(row: ShippingAddressSummaryView) {
  void router.push({
    path: '/supply-chain/crm/customers/profiles',
    query: row.customerCode ? { customerCode: row.customerCode } : { customerName: row.customerName },
  })
}

function sourcePresenceLabel(value: string | null | undefined) {
  if (!value || value === 'PRESENT') return '已同步'
  if (value === 'ABSENT_CANDIDATE') return '待确认'
  if (value === 'ABSENT' || value === 'DELETED') return '来源已删除'
  return value
}

function sourcePresenceTag(value: string | null | undefined) {
  if (!value || value === 'PRESENT') return 'success'
  if (value === 'ABSENT_CANDIDATE') return 'warning'
  if (value === 'ABSENT' || value === 'DELETED') return 'info'
  return 'info'
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
.crm-shipping-address-page {
  min-height: 0;
}
</style>
