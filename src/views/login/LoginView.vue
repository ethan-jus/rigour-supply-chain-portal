<template>
  <main class="login-page">
    <section class="login-page__story" aria-label="门户介绍">
      <div class="brand"><span class="brand__mark">R</span><span>瑞盖优选·统一门户</span></div>
      <div class="story-copy">
        <p class="eyebrow">ONE IDENTITY, EVERY WORKSPACE</p>
        <h1>从一个入口，<br>进入全部业务系统。</h1>
        <p>统一身份、统一权限、统一应用目录。登录后只会看到当前账号获得授权的工作台。</p>
      </div>
      <div class="trust-points" aria-label="安全能力">
        <span>多租户隔离</span><span>OIDC + PKCE</span><span>角色与数据权限</span>
      </div>
    </section>

    <section class="login-page__action">
      <div class="login-card">
        <div class="environment"><i />开发环境</div>
        <p class="eyebrow">统一身份认证</p>
        <h2>欢迎回来</h2>
        <p class="login-card__subtitle">继续后将前往 IAM 安全登录页，门户不会读取或保存你的密码。</p>

        <div v-if="errorMsg" class="error" role="alert">{{ errorMsg }}</div>
        <el-button type="primary" size="large" class="login-button" :loading="loading" :disabled="loading" @click="handleLogin">
          {{ loading ? '正在连接统一身份服务…' : '使用企业账号登录' }}
        </el-button>

        <div class="flow">
          <div><strong>1</strong><span>IAM 完成身份校验</span></div>
          <div><strong>2</strong><span>门户加载应用与权限</span></div>
          <div><strong>3</strong><span>进入已授权的系统</span></div>
        </div>
        <p class="security-note">访问令牌仅保存在当前页面内存中；刷新页面后会重新使用 IAM 会话认证。</p>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const localError = ref('')
const errorMsg = computed(() => localError.value || (route.query.reason === 'oidc_callback_failed'
  ? '统一登录回调校验失败，请重新发起登录。' : ''))

onMounted(() => {
  if (authStore.isAuthenticated) void router.replace('/apps')
})

async function handleLogin() {
  if (loading.value) return
  loading.value = true
  localError.value = ''
  const redirectTimeout = window.setTimeout(() => {
    loading.value = false
    localError.value = '登录跳转超时，请重新发起登录。'
  }, 12000)
  window.addEventListener('pagehide', () => window.clearTimeout(redirectTimeout), { once: true })
  try {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/apps'
    await authStore.login(redirect)
  } catch {
    window.clearTimeout(redirectTimeout)
    localError.value = '无法连接统一身份服务，请检查 IAM 是否已启动。'
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables' as *;
.login-page { min-height: 100vh; display: grid; grid-template-columns: minmax(420px, 1.05fr) minmax(440px, .95fr); background: #f4f7fb; color: #15233b; }
.login-page__story { position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: clamp(42px, 6vw, 88px); color: white; background: linear-gradient(145deg, #102a56, #174a8b 58%, #1c6bb5); }
.login-page__story::after { position: absolute; right: -180px; bottom: -200px; width: 500px; height: 500px; border: 90px solid rgb(255 255 255 / 8%); border-radius: 50%; content: ''; }
.brand { z-index: 1; display: flex; gap: 12px; align-items: center; font-size: 18px; font-weight: 700; letter-spacing: .04em; }
.brand__mark { display: grid; width: 40px; height: 40px; color: #174a8b; background: white; border-radius: 13px; place-items: center; }
.story-copy { z-index: 1; max-width: 620px; }
.eyebrow { margin: 0 0 12px; color: #2e70b3; font-size: 12px; font-weight: 800; letter-spacing: .13em; }
.story-copy .eyebrow { color: rgb(255 255 255 / 64%); }
.story-copy h1 { margin: 0 0 22px; font-size: clamp(38px, 4.7vw, 64px); line-height: 1.13; letter-spacing: -.04em; }
.story-copy > p:last-child { max-width: 560px; margin: 0; color: rgb(255 255 255 / 76%); font-size: 16px; line-height: 1.9; }
.trust-points { z-index: 1; display: flex; flex-wrap: wrap; gap: 10px; }
.trust-points span { padding: 8px 12px; border: 1px solid rgb(255 255 255 / 20%); border-radius: 999px; background: rgb(255 255 255 / 8%); font-size: 13px; }
.login-page__action { display: grid; padding: 32px; place-items: center; }
.login-card { position: relative; width: min(450px, 100%); padding: 42px; border: 1px solid #e2e8f0; border-radius: 22px; background: white; box-shadow: 0 24px 60px rgb(15 42 82 / 12%); }
.environment { position: absolute; top: 22px; right: 22px; display: flex; gap: 7px; align-items: center; color: #607087; font-size: 12px; }
.environment i { width: 7px; height: 7px; border-radius: 50%; background: #21a366; box-shadow: 0 0 0 4px rgb(33 163 102 / 10%); }
.login-card h2 { margin: 0; font-size: 30px; letter-spacing: -.03em; }
.login-card__subtitle { margin: 12px 0 26px; color: #65748b; line-height: 1.75; }
.login-button { width: 100%; height: 50px; font-weight: 700; border-radius: 10px; }
.error { margin-bottom: 16px; padding: 11px 13px; color: #a62024; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 9px; font-size: 13px; line-height: 1.55; }
.flow { display: grid; gap: 10px; margin-top: 24px; padding: 18px; background: #f7f9fc; border-radius: 12px; }
.flow div { display: flex; gap: 10px; align-items: center; color: #526175; font-size: 13px; }
.flow strong { display: grid; width: 22px; height: 22px; color: #1d65aa; background: #e5f0fa; border-radius: 50%; font-size: 11px; place-items: center; }
.security-note { margin: 20px 0 0; color: #8a97a8; font-size: 12px; line-height: 1.7; }
@media (max-width: 900px) { .login-page { grid-template-columns: 1fr; } .login-page__story { min-height: 270px; padding: 36px; } .story-copy h1 { font-size: 36px; } .trust-points { margin-top: 30px; } }
@media (max-width: 520px) { .login-page__story { min-height: 210px; } .story-copy > p:last-child, .trust-points { display: none; } .login-page__action { padding: 16px; } .login-card { padding: 28px 24px; border-radius: 17px; } .environment { position: static; margin-bottom: 28px; } }
</style>
