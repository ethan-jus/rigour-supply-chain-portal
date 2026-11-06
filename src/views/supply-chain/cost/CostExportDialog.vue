<template>
  <el-dialog
    :model-value="modelValue"
    title="自定义导出"
    width="min(720px, 94vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="export-scope">
      <span>导出范围</span><strong>{{ scope }}</strong>
    </div>
    <div class="export-fields-title">
      <strong
        >导出字段 <small>已选 {{ fields.length }} / {{ columns.length }} 项</small></strong
      >
      <div>
        <el-button
          link
          type="primary"
          :disabled="busy"
          @click="
            emit(
              'update:fields',
              columns.map((c) => c.key),
            )
          "
          >全选</el-button
        >
        <el-button link :disabled="busy" @click="emit('update:fields', [])">清空</el-button>
      </div>
    </div>
    <el-checkbox-group
      :model-value="fields"
      class="export-fields"
      aria-label="导出字段"
      :disabled="busy"
      @update:model-value="updateFields"
    >
      <el-checkbox v-for="column in columns" :key="column.key" :value="column.key">{{
        column.label
      }}</el-checkbox>
    </el-checkbox-group>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template #footer>
      <el-button :disabled="busy" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button
        type="primary"
        :loading="busy"
        :disabled="!fields.length || empty"
        @click="emit('confirm')"
        >开始导出</el-button
      >
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
defineProps<{
  modelValue: boolean
  fields: string[]
  columns: { key: string; label: string }[]
  scope: string
  busy: boolean
  error?: string
  empty?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:fields': [value: string[]]
  confirm: []
}>()
function updateFields(value: (string | number | boolean)[]) {
  emit('update:fields', value.map(String))
}
</script>
<style scoped>
.export-scope {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: #f5f7fb;
  border-radius: 6px;
}
.export-scope > span,
.export-fields-title small {
  color: #6d7f99;
}
.export-fields-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 20px 0 8px;
}
.export-fields-title small {
  margin-left: 10px;
  font-weight: 400;
  font-size: 13px;
}
.export-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
  margin-bottom: 16px;
}
.export-fields :deep(.el-checkbox) {
  margin-right: 0;
  height: auto;
  min-height: 32px;
  white-space: normal;
}
.export-fields :deep(.el-checkbox__label) {
  white-space: normal;
}
@media (max-width: 520px) {
  .export-fields {
    grid-template-columns: 1fr;
  }
  .export-scope {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
