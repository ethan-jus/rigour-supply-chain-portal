<template>
  <el-pagination
    class="compact-pagination"
    :current-page="currentPage"
    :page-size="pageSize"
    :total="total"
    :page-sizes="pageSizes"
    layout="total, prev, slot, next, sizes"
    background
    @update:current-page="emit('update:currentPage', $event)"
    @update:page-size="emit('update:pageSize', $event)"
    @current-change="emit('current-change', $event)"
    @size-change="emit('size-change', $event)"
  >
    <div class="compact-pagination__pages">
      <template v-for="(page, index) in pages" :key="page">
        <span v-if="index && page > pages[index - 1] + 1" class="compact-pagination__ellipsis">…</span>
        <button
          type="button"
          :class="{ 'is-active': page === currentPage }"
          :aria-label="`第 ${page} 页`"
          :aria-current="page === currentPage ? 'page' : undefined"
          @click="selectPage(page)"
        >{{ page }}</button>
      </template>
    </div>
  </el-pagination>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  currentPage: number
  pageSize: number
  total: number
  pageSizes?: number[]
}>(), { pageSizes: () => [20, 50, 100, 200] })
const emit = defineEmits<{
  'update:currentPage': [page: number]
  'update:pageSize': [size: number]
  'current-change': [page: number]
  'size-change': [size: number]
}>()

const pages = computed(() => {
  const last = Math.max(1, Math.ceil(props.total / props.pageSize))
  const current = Math.min(last, Math.max(1, props.currentPage))
  const start = current <= 3 ? 1 : Math.min(current - 1, last - 2)
  return [...new Set([1, ...Array.from({ length: Math.min(3, last) }, (_, i) => start + i), last])]
    .sort((a, b) => a - b)
})

function selectPage(page: number) {
  if (page === props.currentPage) return
  emit('update:currentPage', page)
  emit('current-change', page)
}
</script>

<style scoped>
.compact-pagination { gap: 6px; }
.compact-pagination__pages { display: flex; align-items: center; gap: 6px; }
.compact-pagination__pages button,
.compact-pagination :deep(.btn-prev),
.compact-pagination :deep(.btn-next) {
  height: var(--el-pagination-button-height);
  min-width: var(--el-pagination-button-width);
  padding: 0 6px;
  margin: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  font: inherit;
  cursor: pointer;
}
.compact-pagination__pages button:hover { color: var(--el-color-primary); }
.compact-pagination__pages button.is-active { color: var(--el-color-primary); border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.compact-pagination__pages button:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
.compact-pagination__ellipsis { padding: 0 2px; color: var(--el-text-color-placeholder); }
.compact-pagination :deep(.el-pagination__sizes) { margin-left: 4px; }
.compact-pagination :deep(.el-pagination__sizes .el-select) { width: 104px; }
</style>
