<template>
  <template v-if="scope">
    <div class="bi-scope-field" :class="{ 'bi-scope-dark': !light }">
      <span>销售部门</span>
      <el-tree-select
        :model-value="scope.department.value || undefined"
        :data="departments"
        :props="treeProps"
        :default-expanded-keys="expandedDepartments"
        :teleported="light"
        popper-class="bi-scope-tree-popper"
        :show-arrow="false"
        node-key="code"
        check-strictly
        filterable
        clearable
        :render-after-expand="false"
        aria-label="销售部门"
        placeholder="全部授权部门"
        class="bi-scope-select"
        @update:model-value="scope.select('regionCode', $event || '', period)"
      />
    </div>
    <div class="bi-scope-field" :class="{ 'bi-scope-dark': !light }">
      <span>客户归属地区</span>
      <el-tree-select
        :model-value="scope.customerRegion.value || undefined"
        :data="regions"
        :props="treeProps"
        :teleported="light"
        popper-class="bi-scope-tree-popper"
        :show-arrow="false"
        node-key="code"
        check-strictly
        filterable
        clearable
        :render-after-expand="false"
        aria-label="客户归属地区"
        placeholder="全部地区"
        class="bi-scope-select"
        @update:model-value="scope.select('customerRegionCode', $event || '', period)"
      />
    </div>
  </template>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { departmentTree, useDashboardFilters } from '../department-filters'
defineProps<{ period?: Record<string, string | undefined>; light?: boolean }>()
const scope = useDashboardFilters()
const treeProps = { value: 'code', label: 'name', children: 'children' }
const departments = computed(() => departmentTree(scope?.options.value?.departments || []))
const expandedDepartments = computed(() => [
  scope?.options.value?.defaultDepartmentCode,
  scope?.department.value,
].filter((code): code is string => !!code))
const regions = computed(() => departmentTree(scope?.options.value?.customerRegions || []))
</script>
<style scoped>
.bi-scope-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-size: 13px;
}
.bi-scope-select {
  width: var(--list-filter-select-width, 140px);
  flex: 0 0 auto;
}
.bi-scope-dark {
  --el-fill-color-blank: #10263a;
  --el-bg-color-overlay: #10263a;
  --el-fill-color-light: #1d3b54;
  --el-border-color: #36536e;
  --el-border-color-light: #36536e;
  --el-border-color-lighter: #36536e;
  --el-border-color-hover: #6b93b4;
  --el-text-color-primary: #eaf3ff;
  --el-text-color-regular: #eaf3ff;
  --el-text-color-secondary: #b8cde0;
  --el-text-color-placeholder: #a9bfd4;
  --el-color-primary: #82beff;
}
.bi-scope-dark :deep(.el-select__wrapper) {
  min-height: 34px;
}
:global(.bi-scope-tree-popper .el-tree) {
  min-width: 210px;
  --el-tree-node-content-height: 32px;
}
</style>
