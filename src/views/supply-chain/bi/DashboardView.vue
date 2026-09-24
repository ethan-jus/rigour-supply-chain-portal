<template>
  <BiSalesMeetingPresentation
    v-if="section === 'sales'"
    :key="route.fullPath"
    embedded
    :query="query"
    :scope-label="scopeLabel"
  />
  <BiMeetingPresentation
    v-else
    :key="route.fullPath"
    embedded
    :initial-city="section === 'city-operating'"
    :initial-page="initialPage"
    :query="query"
    :scope-label="scopeLabel"
    @overview="navigate('overview', $event)"
    @city="navigate('city-operating', $event)"
    @report="openSection"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { SupplyDashboardQuery } from '@/api/core/bi'
import { businessDate } from '@/utils/business-date'
import BiMeetingPresentation from './components/BiMeetingPresentation.vue'
import BiSalesMeetingPresentation from './components/BiSalesMeetingPresentation.vue'

const route = useRoute()
const router = useRouter()
const section = computed(() => route.meta.dashboardSection)
const query = computed<SupplyDashboardQuery>(() => {
  const filters: SupplyDashboardQuery = {}
  for (const key of [
    'from',
    'to',
    'regionCode',
    'ownerStaffCode',
    'customerTypeCode',
    'productCategoryId',
    'sourceSystemCode',
  ] as const) {
    const value = route.query[key]
    if (typeof value === 'string' && value) filters[key] = value
  }
  return filters
})
const scopeLabel = computed(() =>
  query.value.regionCode ? '当前授权范围 · 已筛选城市' : '当前授权范围',
)
const initialPage = computed(() => {
  const page = Number(route.query.page)
  return Number.isInteger(page) && page >= 0 && page <= 4 ? page : 0
})
function navigate(target: 'overview' | 'city-operating', filters: SupplyDashboardQuery, page = 0) {
  void router.push({
    path: target === 'overview' ? '/supply-chain/bi' : '/supply-chain/bi/city-operating',
    query: {
      ...filters,
      from: filters.from ? businessDate(filters.from) : undefined,
      to: filters.to ? businessDate(filters.to) : undefined,
      page: page || undefined,
    },
  })
}
function openSection(page: number, filters: SupplyDashboardQuery) {
  navigate('overview', filters, page)
}
</script>
