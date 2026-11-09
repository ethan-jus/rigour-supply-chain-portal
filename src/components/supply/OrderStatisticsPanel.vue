<template>
  <section
    class="order-statistics"
    :style="{ '--statistics-columns': columns }"
  >
    <div class="order-statistics__heading">
      <span>{{ title }}<span v-if="collapsed" class="order-statistics__brief"> · {{ brief }}</span></span>
      <el-button text size="small" :aria-expanded="!collapsed" :aria-controls="bodyId" @click="collapsed = !collapsed">
        {{ collapsed ? '展开统计' : '收起统计' }}
        <el-icon class="el-icon--right"><ArrowDown v-if="collapsed" /><ArrowUp v-else /></el-icon>
      </el-button>
    </div>
    <div v-show="!collapsed" :id="bodyId" class="order-statistics__body" role="region" :aria-label="`${title}指标`" tabindex="0"><slot /></div>
  </section>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'

defineProps<{ title: string; brief: string; columns: number }>()
const collapsed = ref(false)
const bodyId = useId()
</script>

<style scoped>
.order-statistics { flex: 0 0 auto; min-width: 0; container-type: inline-size; }
.order-statistics__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
  padding: 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
}
.order-statistics__brief { color: #047857; }
.order-statistics__body {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
}
.order-statistics__body :deep(.order-summary) {
  grid-template-columns: repeat(var(--statistics-columns), minmax(max-content, 1fr));
  min-width: max-content;
  gap: 8px;
  padding: 8px 12px 12px;
  border-radius: 0;
}
.order-statistics__body :deep(.order-summary__metric) { min-width: 112px; min-height: 64px; padding: 8px 10px; gap: 4px; }
.order-statistics__body :deep(.order-summary__value) { font-size: 18px; white-space: nowrap; }
/* 金额需要完整显示小数位，比例和数量可占更少宽度。 */
.order-statistics__body :deep(.order-summary--orders) { grid-template-columns: minmax(max-content, 1.4fr) minmax(max-content, 1.4fr) minmax(max-content, .8fr) minmax(max-content, 1.4fr) minmax(max-content, .8fr) minmax(max-content, 1.4fr) minmax(max-content, 1.4fr) minmax(max-content, .8fr); }
.order-statistics__body :deep(.order-summary--lines) { grid-template-columns: minmax(max-content, 1.4fr) minmax(max-content, 1.4fr) minmax(max-content, .8fr) minmax(max-content, 1.4fr) minmax(max-content, .8fr) minmax(max-content, .9fr) minmax(max-content, 1.4fr) minmax(max-content, 1.4fr) minmax(max-content, .8fr); }
@container (min-width: 1500px) {
  .order-statistics__body :deep(.order-summary__value) { font-size: 20px; }
}
</style>
