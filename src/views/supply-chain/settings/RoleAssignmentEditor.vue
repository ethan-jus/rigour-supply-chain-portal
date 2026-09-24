<template>
  <el-select
    v-if="!fixedRole"
    v-model="selectedIds"
    multiple
    filterable
    style="width: 100%"
    placeholder="选择角色"
    :disabled="disabled"
    ><el-option
      v-for="role in roles"
      :key="role.id"
      :label="role.name"
      :value="role.id"
      :disabled="!removeOnly && role.status !== 'ACTIVE'"
  /></el-select>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { RoleAssignment, SupplyRole } from '@/api/core/supply-settings'
defineProps<{
  roles: SupplyRole[]
  disabled?: boolean
  removeOnly?: boolean
  fixedRole?: boolean
}>()
const assignments = defineModel<RoleAssignment[]>({ default: () => [] })
const selectedIds = computed({
  get: () => assignments.value.map((a) => a.roleId),
  set: (ids) => {
    assignments.value = ids.map((roleId) => ({ roleId, parameters: {} }))
  },
})
</script>
