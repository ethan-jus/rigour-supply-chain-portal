<template>
  <div class="error-page">
    <h1 class="error-code">503</h1>
    <p class="error-desc">身份或业务服务暂时不可用，请稍后重试</p>
    <div class="actions">
      <el-button type="primary" @click="retry">重新加载</el-button>
      <el-button @click="goLogin">返回登录</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { safeReturnPath } from '@/auth/oidc'
import { useAuthStore } from '@/stores'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

function retry() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
  void router.replace(safeReturnPath(redirect))
}

function goLogin() {
  // 用户选择重新登录时停留在表单，避免错误页面与会话恢复之间循环。
  authStore.clearLocalSession()
  void router.replace({ path: '/login', query: { reason: 'service_unavailable' } })
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables' as *;

.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 16px;
  background: $color-bg-base;
}

.error-code {
  margin: 0;
  color: $color-warning;
  font-size: 72px;
  font-weight: 700;
}

.error-desc {
  margin: 0 0 8px;
  color: $color-text-regular;
  font-size: 16px;
}

.actions {
  display: flex;
  gap: 12px;
}
</style>
