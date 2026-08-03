<template>
  <main class="login-redirect">
    <div class="panel">
      <img class="logo" src="@/assets/brand/ruigai-logo.png" alt="瑞盖优选">
      <template v-if="!errorMsg">
        <div class="spinner" aria-hidden="true" />
        <p class="status">{{ statusText }}</p>
      </template>
      <template v-else>
        <p class="error" role="alert">{{ errorMsg }}</p>
        <button class="retry" type="button" @click="startLogin">重新登录</button>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
/**
 * 登录中转页（无独立界面）
 *
 * 职责：
 * - 已登录（内存中有 Token）→ 直接回首页，不打扰用户
 * - 未登录 → 立即发起 OIDC 授权码跳转，由 IAM 决定展示登录表单还是静默放行
 * - 仅在统一身份服务不可达或回调校验失败时展示错误与重试入口
 *
 * 说明：门户不再提供品牌欢迎页，品牌展示由 IAM 登录页承担，
 * 避免每次访问都经过一个无功能的中间页面。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { consumeLogoutPending } from '@/auth/oidc'
import { useAuthStore } from '@/stores'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const errorMsg = ref('')
const statusText = ref('正在前往统一身份认证…')
let logoutRedirectTimer: number | undefined

onBeforeUnmount(() => {
  if (logoutRedirectTimer !== undefined) window.clearTimeout(logoutRedirectTimer)
})

onMounted(() => {
  // 退出回调优先于内存认证状态：跨域返回期间旧Pinia状态可能尚未完成清理，
  // 不能因为短暂的 isAuthenticated=true 把用户重新送回门户首页。
  const logoutPending = consumeLogoutPending() || route.query.reason === 'logout'
  if (logoutPending) {
    statusText.value = '正在完成退出，准备进入登录页…'
    ElMessage.success('已安全退出统一门户，正在进入登录页')
    // 给 Toast 一个绘制机会；随后立即进入 IAM 登录表单，不再停留在门户确认页。
    logoutRedirectTimer = window.setTimeout(() => {
      logoutRedirectTimer = undefined
      void startLogin(true)
    }, 350)
    return
  }
  if (authStore.isAuthenticated) {
    void router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/apps')
    return
  }
  if (route.query.reason === 'oidc_callback_failed') {
    errorMsg.value = '统一登录回调校验失败，请重新发起登录。'
    return
  }
  startLogin()
})

async function startLogin(forceLogin = false) {
  errorMsg.value = ''
  try {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/apps'
    await authStore.login(redirect, forceLogin)
  } catch {
    errorMsg.value = '无法连接统一身份服务，请确认 IAM 已启动后重试。'
  }
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.login-redirect {
  display: grid;
  min-height: 100vh;
  background: $color-bg-base;
  place-items: center;
}

.panel {
  display: grid;
  justify-items: center;
  gap: $spacing-md;
  padding: $spacing-xl;
}

.logo {
  width: 56px;
  height: 56px;
  border-radius: $border-radius-lg;
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid $color-border-base;
  border-top-color: $color-primary;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.status {
  color: $color-text-secondary;
  font-size: $font-size-base;
}

.error {
  max-width: 320px;
  color: $color-danger;
  font-size: $font-size-base;
  line-height: 1.7;
  text-align: center;
}

.retry {
  height: 40px;
  padding: 0 24px;
  color: #fff;
  font: inherit;
  font-weight: 600;
  background: $color-primary;
  border: 0;
  border-radius: $border-radius-base;
  cursor: pointer;

  &:hover {
    background: $color-primary-dark;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
