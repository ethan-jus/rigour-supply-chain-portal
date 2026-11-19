<template>
  <section class="sales-page supply-page supply-page--sales" :class="{ 'sales-page--visit-policy': pageKey === 'policies-visit' }">
    <header v-if="pageKey !== 'policies-visit'" class="page-header">
      <div>
        <SupplyPageTitle>{{ route.meta.title }}</SupplyPageTitle>
      </div>
    </header>

    <SalesVisitPolicy v-if="pageKey === 'policies-visit'" />
    <SalesFieldwork v-else-if="pageKey === 'dashboard'" />
    <SalesVisitPlans v-else-if="pageKey === 'visit-plans'" />
    <SalesVisitAppeals v-else-if="pageKey === 'visit-reviews'" />
    <SalesTrackComparison v-else-if="pageKey === 'exceptions-location'" />
  </section>
</template>

<script setup lang="ts">
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SalesVisitPolicy from './SalesVisitPolicy.vue'
import SalesFieldwork from './SalesFieldwork.vue'
import SalesVisitPlans from './SalesVisitPlans.vue'
import SalesVisitAppeals from './SalesVisitAppeals.vue'
import SalesTrackComparison from './SalesTrackComparison.vue'

const route = useRoute()
const pageKey = computed(() => String(route.meta.pageKey || 'dashboard'))
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.sales-page { display: flex; min-height: 0; flex-direction: column; gap: $spacing-sm; }
.sales-page.supply-page--sales.sales-page--visit-policy { height: 100%; min-height: 0; overflow: hidden; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: $spacing-sm; }
.page-header h1 { margin: 0; font-size: 18px; line-height: 26px; }
@media (max-width: 760px) { .page-header { align-items: flex-start; flex-direction: column; } }
</style>
