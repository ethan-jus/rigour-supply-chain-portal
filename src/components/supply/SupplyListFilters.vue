<script setup lang="ts">
defineProps<{ loading?: boolean; compact?: boolean }>()
defineEmits<{ search: []; reset: [] }>()
</script>

<template>
  <el-card
    class="supply-list-filters"
    :class="{ 'supply-list-filters--compact': compact }"
    shadow="never"
  >
    <el-form
      class="supply-list-filters__form"
      label-position="top"
      @submit.prevent="$emit('search')"
    >
      <slot />
      <div class="supply-list-filters__actions">
        <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
        <el-button :disabled="loading" @click="$emit('reset')">重置</el-button>
      </div>
    </el-form>
    <slot name="feedback" />
  </el-card>
</template>

<style scoped>
.supply-list-filters {
  flex: 0 0 auto;
  overflow: visible;
  border: 1px solid var(--supply-border, var(--el-border-color-light));
  border-radius: var(--supply-radius, 8px);
  background: var(--supply-surface, #fff);
}
.supply-list-filters :deep(.el-card__body) {
  padding: 16px 20px;
}
.supply-list-filters__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  align-items: end;
  gap: 14px 16px;
}
.supply-list-filters__form :deep(.el-form-item) {
  display: block;
  margin: 0;
  min-width: 0;
}
.supply-list-filters__form :deep(.el-form-item__label) {
  margin: 0 0 7px;
  padding: 0;
  line-height: 20px;
  color: var(--el-text-color-regular);
}
.supply-list-filters__form :deep(.el-form-item__content) {
  min-width: 0;
}
.supply-list-filters__form :deep(.el-input),
.supply-list-filters__form :deep(.el-select),
.supply-list-filters__form :deep(.el-date-editor) {
  width: 100%;
  min-width: 0;
}
.supply-list-filters__actions {
  display: flex;
  grid-column: -2 / -1;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}
.supply-list-filters__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.supply-list-filters--compact {
  border: 0;
  background: transparent;
  box-shadow: none;
}
.supply-list-filters--compact :deep(.el-card__body) {
  padding: 4px 0 12px;
}
.supply-list-filters--compact .supply-list-filters__form {
  grid-template-columns: repeat(auto-fit, minmax(160px, 200px));
  gap: 12px 16px;
}
.supply-list-filters--compact .supply-list-filters__actions {
  grid-column: auto;
  justify-content: flex-start;
}
.supply-list-filters--compact :deep(.el-form-item__label) {
  font-size: 12px;
  line-height: 18px;
  margin-bottom: 5px;
  color: #64748b;
}
@media (max-width: 640px) {
  .supply-list-filters :deep(.el-card__body) {
    padding: 12px;
  }
  .supply-list-filters__form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .supply-list-filters__actions {
    grid-column: 1 / -1;
  }
}
</style>
