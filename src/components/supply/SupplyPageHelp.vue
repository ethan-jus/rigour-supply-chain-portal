<template>
  <el-popover
    ref="popover"
    @update:visible="updateDismissListener"
    placement="bottom-start"
    :trigger="['hover', 'focus', 'click']"
    :show-after="120"
    :hide-after="100"
    width="min(420px, 90vw)"
  >
    <template #reference>
      <button type="button" class="page-help" aria-label="查看页面说明">
        <QuestionFilled aria-hidden="true" />
      </button>
    </template>
    <div class="page-help-content"><slot /></div>
  </el-popover>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import type { PopoverInstance } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'

const popover = ref<PopoverInstance>()
function dismiss(event: KeyboardEvent) {
  if (event.key === 'Escape') popover.value?.hide()
}
function updateDismissListener(visible: boolean) {
  if (visible) document.addEventListener('keydown', dismiss)
  else stopListening()
}
function stopListening() {
  document.removeEventListener('keydown', dismiss)
}
onBeforeUnmount(stopListening)
</script>
<style scoped>
.page-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  padding: 5px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
}
.page-help svg {
  width: 18px;
  height: 18px;
}
.page-help:hover,
.page-help:focus-visible {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.page-help:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 1px;
}
.page-help-content {
  font-size: var(--app-font-size-base);
  line-height: 1.65;
  color: var(--app-text-regular);
}
.page-help-content :deep(p:first-child) {
  margin-top: 0;
}
.page-help-content :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
