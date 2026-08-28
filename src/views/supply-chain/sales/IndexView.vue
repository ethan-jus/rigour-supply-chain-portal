<template>
  <section class="sales-page supply-page supply-page--sales">
    <header class="page-header">
      <div>
        <h1>{{ definition.title }}</h1>
      </div>
    </header>

    <SalesDashboard v-if="pageKey === 'dashboard'" />
    <SalesVisitPlans v-else-if="pageKey === 'visit-plans'" />
    <SalesReviewQueue v-else-if="isReviewPage" />
    <SalesTrackComparison v-else-if="isTrackPage" />
    <el-card v-else class="empty-feature-card" shadow="never">
      <el-empty description="功能暂未开放" />
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SALES_PAGES } from './catalog'
import SalesDashboard from './SalesDashboard.vue'
import SalesVisitPlans from './SalesVisitPlans.vue'
import SalesReviewQueue from './SalesReviewQueue.vue'
import SalesTrackComparison from './SalesTrackComparison.vue'

const route = useRoute()
const pageKey = computed(() => String(route.meta.pageKey || 'dashboard'))
const definition = computed(() => SALES_PAGES[pageKey.value] || SALES_PAGES.dashboard)
const isReviewPage = computed(() => ['visit-reviews', 'exceptions-reviews'].includes(pageKey.value))
const isTrackPage = computed(() => pageKey.value === 'exceptions-location')

</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.sales-page { display: flex; min-height: 0; flex-direction: column; gap: $spacing-sm; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: $spacing-sm; }
.page-header h1 { margin: 0; font-size: 18px; line-height: 26px; }
.empty-feature-card { display: grid; min-height: 360px; place-items: center; border-color: $color-border-base; box-shadow: none; }
@media (max-width: 760px) { .page-header { align-items: flex-start; flex-direction: column; } }
</style>
