<script setup lang="ts">
import { computed } from 'vue'
import type { DepartmentScopeRow } from '@/utils/hr-department-tree'
import SupplyScopeSummary from './SupplyScopeSummary.vue'
import SupplyDepartmentTree from './SupplyDepartmentTree.vue'

const props = withDefaults(
  defineProps<{
    departments: DepartmentScopeRow[]
    ids: number[]
    emptyText?: string
  }>(),
  { emptyText: '-' },
)
const selectedIds = computed(() => [...new Set(props.ids)])
const names = computed(() =>
  selectedIds.value.map(
    (id) =>
      props.departments.find((department) => department.id === id)?.name || `未匹配部门（${id}）`,
  ),
)
</script>

<template>
  <SupplyScopeSummary :items="names" label="部门" :empty-text="emptyText" show-details>
    <SupplyDepartmentTree :departments="departments" :selected-ids="selectedIds" />
  </SupplyScopeSummary>
</template>
