<template>
  <el-popover trigger="click" :width="240" placement="bottom-end">
    <template #reference>
      <el-button size="small" :plain="plain">列设置</el-button>
    </template>
    <div class="column-settings">
      <el-checkbox-group
        :model-value="checkedKeys"
        aria-label="列设置"
        @update:model-value="onChange"
      >
        <el-checkbox
          v-for="column in columns"
          :key="column.key"
          :value="column.key"
          :disabled="column.locked"
          class="column-settings__item"
        >
          {{ column.label }}
        </el-checkbox>
      </el-checkbox-group>
      <div class="column-settings__actions">
        <el-button link type="primary" size="small" @click="emit('reset')">恢复默认</el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ColumnSetting } from '@/composables/useColumnSettings'

const props = defineProps<{
  columns: ColumnSetting[]
  visibility: Record<string, boolean>
  /** 与查询区其他次级按钮保持一致的浅底样式。 */
  plain?: boolean
}>()
const emit = defineEmits<{ change: [key: string, visible: boolean]; reset: [] }>()

const checkedKeys = computed(() =>
  props.columns
    .filter((column) => props.visibility[column.key] !== false)
    .map((column) => column.key),
)

function onChange(keys: Array<string | number | boolean>) {
  for (const column of props.columns) {
    const next = keys.includes(column.key)
    if ((props.visibility[column.key] !== false) !== next) {
      emit('change', column.key, next)
    }
  }
}
</script>

<style scoped>
.column-settings {
  display: flex;
  flex-direction: column;
}
.column-settings__item {
  margin-right: 0;
}
.column-settings__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}
</style>
