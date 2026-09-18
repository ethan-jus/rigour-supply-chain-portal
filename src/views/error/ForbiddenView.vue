<template>
  <div class="error-page">
    <h1 class="error-code">
      403
    </h1>
    <p class="error-desc">
      您没有权限访问此页面
    </p>
    <el-button type="primary" @click="$router.push('/supply-chain')">
      返回首页
    </el-button>
    <el-button @click="auth.logout()">退出登录</el-button>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores'
const auth = useAuthStore()
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
