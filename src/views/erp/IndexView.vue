<template>
  <div class="module-page">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ pageTitle }}</span>
          <el-tag type="info" size="small">开发中</el-tag>
        </div>
      </template>
      <el-empty description="此模块正在建设中" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const pageTitle = computed(() => (route.meta?.title as string) || '模块')
</script>

<style lang="scss" scoped>
.module-page {
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-title {
    font-size: 16px;
    font-weight: 600;
  }
}
</style>
