<template>
  <div class="erp-list-workspace supply-page">
    <section class="erp-list-workspace__filters"><slot name="filters" /></section>
    <slot name="summary" />
    <section class="erp-list-workspace__results">
      <header class="erp-list-workspace__toolbar">
        <div class="erp-list-workspace__caption">
          <h2>{{ title }}</h2>
          <span>{{ total }} 条</span>
        </div>
        <div class="erp-list-workspace__actions"><slot name="actions" /></div>
      </header>
      <div class="erp-list-workspace__table"><slot /></div>
      <footer class="erp-list-workspace__pagination"><slot name="pagination" /></footer>
    </section>
  </div>
</template>
<script setup lang="ts">
defineProps<{ title: string; total: number }>()
</script>
<style scoped>
.erp-list-workspace {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  min-width: 0;
  color: var(--supply-text, #172033);
}
.erp-list-workspace__filters,
.erp-list-workspace__results {
  background: #fff;
  border: 1px solid var(--supply-border, #e2e8f0);
  border-radius: 6px;
}
.erp-list-workspace__filters {
  flex: none;
  padding: 16px 18px;
}
.erp-list-workspace__results {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 200px;
  overflow: hidden;
}
.erp-list-workspace__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--supply-border, #e2e8f0);
  flex: none;
}
.erp-list-workspace__caption,
.erp-list-workspace__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.erp-list-workspace__caption h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.erp-list-workspace__caption span {
  font-size: 12px;
  white-space: nowrap;
  border-radius: 12px;
  background: #eff6ff;
  color: #2563eb;
  padding: 2px 9px;
}
.erp-list-workspace__table {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.erp-list-workspace__table :deep(.el-table) {
  flex: 1;
  min-width: 0;
}
.erp-list-workspace__table :deep(.el-table th.el-table__cell) {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
}
.erp-list-workspace__table :deep(.el-table .cell) {
  line-height: 22px;
}
.erp-list-workspace__table :deep(.el-table td.el-table__cell) {
  padding: 10px 0;
}
.erp-list-workspace__pagination {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 12px 18px;
  border-top: 1px solid #e2e8f0;
  overflow: auto;
}
:deep(.erp-query-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px 24px;
}
:deep(.erp-query-grid .el-form-item) {
  margin: 0;
  min-width: 0;
}
:deep(.erp-query-grid .el-form-item__content) {
  min-width: 0;
}
:deep(.erp-query-grid .el-select),
:deep(.erp-query-grid .el-date-editor) {
  width: 100%;
  min-width: 0;
}
:deep(.erp-query-actions) {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}
:deep(.erp-row-actions) {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}
:deep(.erp-row-actions .el-button) {
  margin: 0;
  padding: 2px 0;
}
@media (max-width: 700px) {
  .erp-list-workspace__filters {
    padding: 14px;
  }
  .erp-list-workspace__toolbar {
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 12px 14px;
  }
  :deep(.erp-query-grid) {
    grid-template-columns: 1fr;
  }
  .erp-list-workspace__pagination {
    justify-content: flex-start;
    padding: 10px;
  }
}
</style>
