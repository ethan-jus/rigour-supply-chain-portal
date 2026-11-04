<template>
  <el-drawer
    v-model="visible"
    class="erp-record-drawer"
    :title="title"
    :size="size"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <slot />
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </el-drawer>
</template>
<script setup lang="ts">
const visible = defineModel<boolean>({ default: false })
withDefaults(defineProps<{ title: string; size?: string }>(), { size: 'min(1000px, 96vw)' })
</script>
<style scoped>
:global(.erp-record-drawer .el-drawer__header) {
  margin: 0;
  padding: 18px 22px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
  flex: none;
}
:global(.erp-record-drawer .el-drawer__title) {
  font-size: 17px;
  font-weight: 600;
  color: #172033;
}
:global(.erp-record-drawer .el-drawer__body) {
  min-height: 0;
  padding: 20px 22px;
  background: #f6f8fb;
  overflow-y: auto;
}
:global(.erp-record-drawer .el-drawer__footer) {
  padding: 14px 22px;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  flex: none;
}
@media (max-width: 700px) {
  :global(.erp-record-drawer .el-drawer__body) {
    padding: 16px;
  }
}
</style>
