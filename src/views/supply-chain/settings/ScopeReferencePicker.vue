<template>
  <el-tree-select
    v-model="selected"
    :data="tree"
    node-key="key"
    :props="{ label: 'name', children: 'children', disabled: 'disabled' }"
    multiple
    show-checkbox
    check-strictly
    filterable
    clearable
    collapse-tags
    collapse-tags-tooltip
    :loading="loading"
    :disabled="disabled"
    style="width: 100%"
    :placeholder="'选择' + labels[dimension]"
  />
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  supplyAccessApi,
  type ScopeDimension,
  type ScopeReference,
} from '@/api/core/supply-settings'
const props = defineProps<{ dimension: ScopeDimension; disabled?: boolean }>()
const selected = defineModel<string[]>({ default: () => [] })
const labels = { DEPARTMENT: '部门', REGION: '客户归属地区', WAREHOUSE: '仓库' }
const loading = ref(false),
  rows = ref<ScopeReference[]>([])
type Node = ScopeReference & { children: Node[]; disabled: boolean }
const tree = computed(() => {
  const map = new Map(
    rows.value.map((r) => [
      r.key,
      { ...r, children: [] as Node[], disabled: r.status !== 'ACTIVE' },
    ]),
  )
  const roots: Node[] = []
  for (const r of map.values()) {
    const parent = r.parentKey ? map.get(r.parentKey) : null
    if (parent && parent !== r) parent.children.push(r)
    else roots.push(r)
  }
  return roots
})
watch(
  () => props.dimension,
  async (dimension) => {
    loading.value = true
    try {
      rows.value = await supplyAccessApi.references(dimension)
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '范围目录加载失败')
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>
