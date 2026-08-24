<template>
  <div class="supply-page supply-page--overview">
    <ConsoleDashboard />
  </div>
</template>

<script setup lang="ts">
import ConsoleDashboard from '@/components/console/ConsoleDashboard.vue'
</script>

<style scoped lang="scss">
.supply-page--overview {
  height: 100%;
  min-height: 0;
}

.supply-page--overview :deep(.dashboard) {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.supply-page--overview :deep(.dashboard__heading),
.supply-page--overview :deep(.metrics),
.supply-page--overview :deep(.activity-panel) {
  flex: 0 0 auto;
}

.supply-page--overview :deep(.dashboard__grid) {
  min-height: 0;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1.65fr) minmax(280px, 1fr);
}

.supply-page--overview :deep(.trend-panel),
.supply-page--overview :deep(.dashboard__side),
.supply-page--overview :deep(.todo-panel) {
  min-height: 0;
}

.supply-page--overview :deep(.trend-panel) {
  display: flex;
  flex-direction: column;
}

.supply-page--overview :deep(.chart-empty) {
  min-height: 0;
  flex: 1 1 auto;
}

@media (max-width: 900px) {
  .supply-page--overview {
    height: auto;
    min-height: 100%;
  }

  .supply-page--overview :deep(.dashboard) {
    height: auto;
  }

  .supply-page--overview :deep(.dashboard__grid) {
    grid-template-columns: 1fr;
  }

  .supply-page--overview :deep(.chart-empty) {
    min-height: 240px;
  }
}
</style>
