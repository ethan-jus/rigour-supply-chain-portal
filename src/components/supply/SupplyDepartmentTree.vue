<script setup lang="ts">
import { computed } from 'vue'
import { OfficeBuilding } from '@element-plus/icons-vue'
import { departmentScopeTree, type DepartmentScopeRow } from '@/utils/hr-department-tree'

const props = defineProps<{ departments: DepartmentScopeRow[]; selectedIds: number[] }>()
const scope = computed(() => {
  try {
    return { nodes: departmentScopeTree(props.departments, props.selectedIds), error: '' }
  } catch {
    return { nodes: [], error: '部门层级存在循环，暂无法展示组织树，请联系管理员处理。' }
  }
})
</script>

<template>
  <div class="department-scope-tree" aria-label="适用部门组织树">
    <p class="department-scope-tree__hint">按组织层级展示；“仅展示层级”节点不在适用范围内。</p>
    <el-alert v-if="scope.error" :title="scope.error" type="error" :closable="false" />
    <el-tree
      v-else
      :data="scope.nodes"
      :props="{ label: 'name', children: 'children' }"
      node-key="id"
      default-expand-all
      :expand-on-click-node="false"
      :indent="22"
      empty-text="未配置适用部门"
    >
      <template #default="{ data }">
        <span class="department-scope-tree__node" :class="{ 'is-context': !data.selected }">
          <el-icon><OfficeBuilding /></el-icon>
          <span class="department-scope-tree__name" :title="data.name">{{ data.name }}</span>
          <span v-if="!data.selected" class="department-scope-tree__context">仅展示层级</span>
        </span>
      </template>
    </el-tree>
  </div>
</template>

<style scoped>
.department-scope-tree {
  max-height: 320px;
  overflow: auto;
}
.department-scope-tree__hint {
  margin: 10px 0;
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}
.department-scope-tree :deep(.el-tree-node__content) {
  height: 34px;
  border-radius: 4px;
}
.department-scope-tree :deep(.el-tree-node__children) {
  position: relative;
}
.department-scope-tree :deep(.el-tree-node__children::before) {
  position: absolute;
  top: 0;
  bottom: 16px;
  left: 11px;
  border-left: 1px solid #dce4ef;
  content: '';
  pointer-events: none;
}
.department-scope-tree__node {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-right: 12px;
  color: #253c58;
}
.department-scope-tree__node .el-icon {
  flex: none;
  color: var(--el-color-primary);
}
.department-scope-tree__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.department-scope-tree__node.is-context {
  color: #64748b;
}
.department-scope-tree__node.is-context .el-icon {
  color: #94a3b8;
}
.department-scope-tree__context {
  flex: none;
  font-size: 11px;
  color: #64748b;
}
</style>
