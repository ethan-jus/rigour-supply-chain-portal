<template>
  <div class="portal-shell">
    <header class="portal-header">
      <router-link class="brand" to="/apps"><span>R</span><strong>瑞盖统一应用门户</strong></router-link>
      <div class="account">
        <div class="account__avatar">{{ authStore.user?.displayName?.slice(0, 1) || '用' }}</div>
        <div class="account__copy">
          <strong>{{ authStore.user?.displayName || '当前用户' }}</strong>
          <span>{{ accountContext }}</span>
        </div>
        <el-button class="logout" text @click="logout">退出</el-button>
      </div>
    </header>
    <div class="security-bar"><span><i />身份已由 IAM 验证</span><span>应用与权限以当前数据库配置为准</span></div>
    <main class="portal-content"><router-view /></main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores'

const authStore = useAuthStore()
const accountContext = computed(() => authStore.user?.principalScope === 'PLATFORM'
  ? '平台管理员'
  : authStore.user?.tenantName || '企业用户')
function logout() { authStore.logout() }
</script>

<style scoped lang="scss">
.portal-shell { min-height: 100vh; color: #17233b; background: #f4f7fb; }
.portal-header { display: flex; justify-content: space-between; align-items: center; height: 70px; padding: 0 clamp(20px, 4vw, 56px); background: white; border-bottom: 1px solid #e6ebf2; }
.brand { display: flex; gap: 12px; align-items: center; color: #17233b; text-decoration: none; }
.brand > span { display: grid; width: 36px; height: 36px; color: white; background: linear-gradient(145deg, #174a8b, #1d70ba); border-radius: 11px; font-weight: 800; place-items: center; }
.brand strong { font-size: 17px; letter-spacing: .01em; }
.account { display: flex; gap: 11px; align-items: center; }
.account__avatar { display: grid; width: 36px; height: 36px; color: #1a5f9f; background: #eaf2fa; border-radius: 50%; font-weight: 700; place-items: center; }
.account__copy { display: grid; gap: 2px; min-width: 110px; }
.account__copy strong { font-size: 13px; }.account__copy span { color: #7c8a9e; font-size: 11px; }
.logout { color: #536278; }.security-bar { display: flex; justify-content: space-between; gap: 16px; padding: 8px clamp(20px, 4vw, 56px); color: #627188; background: #f8fafc; border-bottom: 1px solid #e8edf3; font-size: 12px; }
.security-bar span:first-child { display: flex; gap: 8px; align-items: center; color: #2a6b50; }.security-bar i { width: 7px; height: 7px; background: #23a36d; border-radius: 50%; }
.portal-content { max-width: 1280px; margin: 0 auto; padding: clamp(28px, 4vw, 52px) clamp(20px, 4vw, 44px); }
@media(max-width:640px){.portal-header{height:64px}.brand strong{display:none}.account__copy{min-width:0}.security-bar span:last-child{display:none}.portal-content{padding-top:28px}}
</style>
