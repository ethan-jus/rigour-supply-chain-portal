<template>
  <aside class="department-sidebar" aria-label="部门筛选">
    <h3>部门</h3>
    <el-input v-model="keyword" placeholder="搜索部门名称" clearable aria-label="搜索部门名称" />
    <el-tree
      ref="tree"
      :data="nodes"
      node-key="id"
      :props="{ label: 'label', children: 'children' }"
      :current-node-key="modelValue ?? 'ALL'"
      highlight-current
      default-expand-all
      :expand-on-click-node="false"
      :filter-node-method="filterNode"
      @node-click="select"
    />
    <p>选择部门包含下级部门</p>
  </aside>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TreeInstance, TreeNodeData } from 'element-plus'
export interface DepartmentChoice {
  id: number
  parentId: number | null
  label: string
}
const props = defineProps<{ departments: DepartmentChoice[]; modelValue: number | null }>()
const emit = defineEmits<{ 'update:modelValue': [id: number | null] }>()
type Node = { id: number | string; label: string; children: Node[] }
const keyword = ref(''),
  tree = ref<TreeInstance>()
const nodes = computed(() => {
  const map = new Map(
    props.departments.map((d) => [d.id, { id: d.id, label: d.label, children: [] as Node[] }]),
  )
  const roots: Node[] = []
  for (const d of props.departments) {
    const node = map.get(d.id)!
    const parent = d.parentId == null ? null : map.get(d.parentId)
    if (parent && d.parentId !== d.id) parent.children.push(node)
    else roots.push(node)
  }
  return [{ id: 'ALL', label: '全部部门', children: roots }]
})
watch(keyword, (value) => tree.value?.filter(value))
function filterNode(value: string, node: TreeNodeData) {
  return !value || node.id === 'ALL' || node.label.includes(value)
}
function select(node: Node) {
  emit('update:modelValue', node.id === 'ALL' ? null : Number(node.id))
}
</script>
<style scoped>
.department-sidebar {
  width: 240px;
  flex: 0 0 240px;
  padding: 18px 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  align-self: stretch;
}
h3 {
  font-size: 15px;
  margin: 0 0 14px;
}
.el-tree {
  margin-top: 16px;
}
p {
  color: #94a3b8;
  font-size: 12px;
  margin-top: 20px;
}
:deep(.el-tree-node__content) {
  min-height: 36px;
  height: auto;
  padding: 5px 0;
}
:deep(.el-tree-node__label) {
  white-space: normal;
  word-break: break-word;
}
@media (max-width: 900px) {
  .department-sidebar {
    width: auto;
    flex-basis: auto;
    max-height: 280px;
    overflow: auto;
  }
}
</style>
