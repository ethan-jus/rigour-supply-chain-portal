<template>
  <div class="pagination-row list-table-footer">
    <div class="list-table-footer__actions"><slot name="actions" /></div>
    <slot />
  </div>
</template>

<style scoped>
.list-table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px 16px;
}
.list-table-footer__actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.list-table-footer__actions :deep(.el-button) { margin-left: 0; }
.list-table-footer :deep(.el-pagination) { margin-left: auto; }
@media (max-width: 720px) {
  .list-table-footer { overflow-x: auto; }
}
</style>
