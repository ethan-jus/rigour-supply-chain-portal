<template>
  <el-popover placement="bottom-start" trigger="click" width="min(420px, 90vw)">
    <template #reference
      ><el-button class="page-help" text :icon="InfoFilled" aria-label="查看页面说明"
        >说明</el-button
      ></template
    >
    <div class="page-help-content"><slot /></div>
  </el-popover>
</template>
<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
</script>
<style scoped>
.page-help {
  font-size: var(--app-font-size-base);
  color: var(--app-text-secondary);
  padding: 4px 8px;
}
.page-help-content {
  font-size: var(--app-font-size-base);
  line-height: 1.65;
  color: var(--app-text-regular);
}
</style>
