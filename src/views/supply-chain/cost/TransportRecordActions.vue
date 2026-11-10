<template>
  <div class="transport-actions">
    <el-button v-if="!detail" link type="primary" @click="emit('view')">查看</el-button>
    <template v-if="record.statusCode === 'DRAFT'">
      <el-button v-if="can('order:logistics-cost:write')" :link="!detail" @click="emit('edit')"
        >编辑</el-button
      >
      <template v-if="detail">
        <el-button
          v-if="can('order:logistics-cost:confirm')"
          type="primary"
          @click="emit('action', 'confirm')"
          >确认</el-button
        >
        <el-button v-if="can('order:logistics-cost:void')" @click="emit('action', 'void')"
          >作废</el-button
        >
      </template>
      <el-dropdown
        v-else-if="can('order:logistics-cost:confirm') || can('order:logistics-cost:void')"
      >
        <el-button link type="primary"
          >更多<el-icon><ArrowDown /></el-icon
        ></el-button>
        <template #dropdown
          ><el-dropdown-menu>
            <el-dropdown-item
              v-if="can('order:logistics-cost:confirm')"
              @click="emit('action', 'confirm')"
              >确认</el-dropdown-item
            >
            <el-dropdown-item
              v-if="can('order:logistics-cost:void')"
              @click="emit('action', 'void')"
              >作废</el-dropdown-item
            >
          </el-dropdown-menu></template
        >
      </el-dropdown>
    </template>
    <el-button
      v-if="record.statusCode === 'CONFIRMED' && can('order:logistics-cost:confirm')"
      :link="!detail"
      type="primary"
      @click="emit('action', 'revoke')"
      >撤销</el-button
    >
    <el-button
      v-if="record.statusCode === 'VOID' && can('order:logistics-cost:void')"
      :link="!detail"
      type="danger"
      @click="emit('action', 'delete')"
      >删除</el-button
    >
  </div>
</template>
<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import type { CostRecord } from '@/api/core/cost'
defineProps<{ record: CostRecord; detail?: boolean }>()
const emit = defineEmits<{
  view: []
  edit: []
  action: [action: 'confirm' | 'revoke' | 'void' | 'delete']
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
