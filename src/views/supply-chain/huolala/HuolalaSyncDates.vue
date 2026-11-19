<template>
  <div class="sync-date-fields" role="group" :aria-label="label">
    <el-form-item label="开始日期">
      <el-date-picker
        v-model="from"
        type="date"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        placeholder="选择开始日期"
        popper-class="huolala-sync-start-calendar"
        :disabled="disabled"
      />
    </el-form-item>
    <el-form-item label="结束日期">
      <el-date-picker
        v-model="to"
        type="date"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        placeholder="选择结束日期"
        popper-class="huolala-sync-end-calendar"
        :disabled="disabled"
      />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string; disabled?: boolean }>()
const from = defineModel<string | null>('from', { required: true })
const to = defineModel<string | null>('to', { required: true })
</script>

<style scoped>
.sync-date-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr));
  column-gap: 16px;
}

.sync-date-fields :deep(.el-date-editor) {
  width: 100%;
}
</style>
