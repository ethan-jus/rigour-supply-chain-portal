<template>
  <div class="error-page">
    <h1 class="error-code">
      404
    </h1>
    <p class="error-desc">
      页面不存在或已被移除
    </p>
    <el-button type="primary" @click="$router.push('/dashboard')">
      返回工作台
    </el-button>
  </div>
</template>

<script setup lang="ts">
// 404 Not Found — 仅处理不存在的路径
// 403 由独立 ForbiddenView 处理
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables' as *;
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;

  .error-code {
    font-size: 72px;
    color: $color-primary;
    font-weight: 700;
  }

  .error-desc {
    font-size: 16px;
    color: $color-text-regular;
    margin-bottom: 8px;
  }
}
</style>
