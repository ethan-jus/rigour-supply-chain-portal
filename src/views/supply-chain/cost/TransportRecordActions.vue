<template>
  <div class="transport-actions">
    <el-button v-if="!detail" link type="primary" @click="emit('view')">查看</el-button>
    <template v-if="record.statusCode === 'ACTIVE'">
      <el-button v-if="can('order:logistics-cost:write')" :link="!detail" @click="emit('edit')"
        >编辑</el-button
      >
      <el-button
        v-if="can('order:logistics-cost:void')"
        :link="!detail"
        @click="emit('action', 'void')"
        >作废</el-button
      >
    </template>
    <el-button
      v-if="record.statusCode === 'VOID' && can('order:logistics-cost:delete')"
      :link="!detail"
      type="danger"
      @click="emit('action', 'delete')"
      >删除</el-button
    >
  </div>
</template>
<script setup lang="ts">
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import type { CostRecord } from '@/api/core/cost'
defineProps<{ record: CostRecord; detail?: boolean }>()
const emit = defineEmits<{
  view: []
  edit: []
  action: [action: 'void' | 'delete']
}>()
const { can } = useSupplyPermissions()
</script>
<style scoped>
.transport-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.transport-actions .el-button {
  margin: 0;
}
</style>
