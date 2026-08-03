<template>
  <div class="portal-shell">
    <header class="portal-header">
      <router-link class="brand" to="/apps">
        <img class="brand__logo" src="@/assets/brand/ruigai-logo.png" alt="瑞盖优选">
        <strong>瑞盖优选</strong>
        <span class="brand__divider" aria-hidden="true">/</span>
        <span class="brand__sub">统一门户</span>
      </router-link>

      <div class="topbar-right">
        <span class="verified"><i aria-hidden="true" />身份已由 IAM 验证</span>
        <div class="account">
          <div class="account__avatar">{{ authStore.user?.displayName?.slice(0, 1) || '用' }}</div>
          <div class="account__copy">
            <strong>{{ authStore.user?.displayName || '当前用户' }}</strong>
            <span>{{ accountContext }}</span>
          </div>
          <el-button class="logout" text @click="logout">退出</el-button>
        </div>
      </div>
    </header>
    <main class="portal-content"><router-view /></main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores'

const authStore = useAuthStore()
const accountContext = computed(() => authStore.user?.principalScope === 'PLATFORM'
  ? '平台管理'
  : authStore.user?.tenantName || '企业用户')
function logout() { authStore.logout() }
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.portal-shell {
  min-height: 100vh;
  color: $color-text-primary;
  background: $color-bg-base;
}

.portal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: $topbar-height;
  padding: 0 clamp(20px, 4vw, 48px);
  background: $color-bg-white;
  border-bottom: 1px solid $color-border-base;
}

.brand {
  display: flex;
  gap: 10px;
  align-items: center;
  color: $color-text-primary;
  text-decoration: none;

  &__logo {
    width: 36px;
    height: 36px;
    border-radius: 9px;
  }

  strong {
    font-size: $font-size-md;
    font-weight: 600;
  }

  &__divider {
    color: $color-border-base;
  }

  &__sub {
    color: $color-text-secondary;
    font-size: $font-size-base;
  }
}

.topbar-right {
  display: flex;
  gap: $spacing-lg;
  align-items: center;
}

.verified {
  display: flex;
  gap: 7px;
  align-items: center;
  color: $color-success;
  font-size: $font-size-sm;

  i {
    width: 7px;
    height: 7px;
    background: $color-success;
    border-radius: 50%;
  }
}

.account {
  display: flex;
  gap: 10px;
  align-items: center;
  padding-left: $spacing-lg;
  border-left: 1px solid $color-border-base;

  &__avatar {
    display: grid;
    width: 34px;
    height: 34px;
    color: $color-primary;
    background: #eff6ff;
    border-radius: 50%;
    font-weight: 600;
    place-items: center;
  }

  &__copy {
    display: grid;
    gap: 1px;

    strong {
      font-size: $font-size-sm;
      font-weight: 500;
    }

    span {
      color: $color-text-secondary;
      font-size: $font-size-xs;
    }
  }
}

.logout {
  color: $color-text-secondary;
}

.portal-content {
  max-width: 1120px;
  margin: 0 auto;
  padding: 40px clamp(20px, 4vw, 40px) 56px;
}

@media (max-width: 640px) {
  .brand__sub,
  .brand__divider,
  .verified {
    display: none;
  }

  .portal-content {
    padding-top: 28px;
  }
}
</style>
