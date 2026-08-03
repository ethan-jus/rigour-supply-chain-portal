<template>
  <el-card>
    <template #header><strong>{{ title }}</strong></template>
    <el-empty :description="description">
      <template #image><div class="module-mark">模块</div></template>
    </el-empty>
    <el-alert v-if="note" type="info" :closable="false" show-icon :title="note" />
  </el-card>
</template>

<script setup lang="ts">
defineProps<{ title: string; description: string; note?: string }>()
</script>

<style scoped>
.module-mark { width: 72px; height: 72px; display: grid; place-items: center; color: #246aa8; background: #eef5fc; border-radius: 18px; font-weight: 700; }
</style>
