<template>
  <div class="error-page">
    <h1 class="error-code">
      403
    </h1>
    <p class="error-desc">
      您没有权限访问此页面
    </p>
    <el-button type="primary" @click="$router.push('/dashboard')">
      返回工作台
    </el-button>
  </div>
</template>

<script setup lang="ts">
// 403 Forbidden — 独立于 404 的错误页面
// 当用户已登录但权限不足时跳转至此
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
    color: $color-warning;
    font-weight: 700;
  }

  .error-desc {
    font-size: 16px;
    color: $color-text-regular;
    margin-bottom: 8px;
  }
}
</style>
