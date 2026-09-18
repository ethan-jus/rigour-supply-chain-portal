<template>
  <main class="login-page">
    <div class="login-frame">
      <section class="brand-panel" aria-labelledby="platform-title">
        <div class="introduction">
          <img class="brand-logo" src="@/assets/brand/scdp-logo.png" alt="">
          <p class="eyebrow">RIGOUR SCDP</p>
          <h1 id="platform-title">瑞盖供应链<span>数字化平台</span></h1>
          <p class="brand-description">连接客户、订单与库存，<br class="desktop-break">让每一步业务高效协同。</p>
        </div>
        <div class="capabilities" aria-label="平台业务">
          <span>客户管理</span><span>订单流转</span><span>库存协同</span>
        </div>
      </section>
      <section class="login-panel" aria-labelledby="login-title">
        <div class="form-column">
          <p class="form-eyebrow">欢迎回来</p>
          <h2 id="login-title">登录工作空间</h2>
          <p class="subtitle">使用企业账号，开启今天的工作。</p>
          <p v-if="notice" class="notice" role="status">{{ notice }}</p>
          <p v-if="errorMsg" class="error" role="alert">{{ errorMsg }}</p>
          <form :aria-busy="pending || checking" @submit.prevent="submit">
            <div class="form-field">
              <label for="tenant-code">企业编码</label>
              <input id="tenant-code" v-model.trim="credentials.tenantCode" name="tenantCode" required maxlength="32" autocomplete="organization" placeholder="请输入企业编码" :disabled="pending">
            </div>
            <div class="form-field">
              <label for="username">用户名</label>
              <input id="username" v-model.trim="credentials.username" name="username" required maxlength="64" autocomplete="username" placeholder="请输入用户名" :disabled="pending">
            </div>
            <div class="form-field">
              <label for="password">密码</label>
              <div class="password-field">
                <input id="password" v-model="credentials.password" :type="showPassword ? 'text' : 'password'" name="password" required maxlength="128" autocomplete="current-password" placeholder="请输入密码" :disabled="pending">
                <button type="button" class="password-toggle" :aria-label="showPassword ? '隐藏密码' : '显示密码'" :aria-pressed="showPassword" :disabled="pending" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</button>
              </div>
            </div>
            <button class="submit" type="submit" :disabled="pending || checking">{{ pending ? '正在登录…' : checking ? '正在检查登录状态…' : '登录' }}</button>
          </form>
          <p class="help">账号由企业管理员分配。<br>如需开通账号或重置密码，请联系本企业管理员。</p>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { assertOidcBrowserOrigin } from '@/auth/oidc'
import { readBrowserSession, submitBrowserLogin } from '@/auth/browser-session'
import { useAuthStore } from '@/stores'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const credentials = reactive({ tenantCode: '', username: '', password: '' })
const errorMsg = ref('')
const notice = ref('')
const showPassword = ref(false)
const pending = ref(false)
const checking = ref(true)
let active = true
onBeforeUnmount(() => { active = false; credentials.password = '' })

onMounted(async () => {
  const loggedOut = route.query.reason === 'logout'
  const manualLogin = loggedOut || Boolean(route.query.reason)
  if (loggedOut) notice.value = '已安全退出，请重新登录。'
  if (route.query.reason === 'oidc_callback_failed') errorMsg.value = '登录验证未完成，请重新登录。'
  if (['reauthenticate', 'session_expired'].includes(String(route.query.reason))) notice.value = '登录状态已过期，请重新登录。'
  try {
    assertOidcBrowserOrigin()
    if (authStore.isAuthenticated && !manualLogin) {
      await router.replace('/supply-chain')
      return
    }
    const session = await readBrowserSession()
    // 初次访问留在前端表单；只有仍然有效的既有会话才自动续期。
    if (active && session.authenticated && !manualLogin) await authStore.login()
  } catch (error) {
    if (active) errorMsg.value = error instanceof Error ? error.message : '登录服务暂时不可用。'
  } finally { checking.value = false }
})

async function submit() {
  if (pending.value || checking.value) return
  pending.value = true
  errorMsg.value = ''
  notice.value = ''
  try {
    assertOidcBrowserOrigin()
    await submitBrowserLogin({ ...credentials })
    credentials.password = ''
    if (active) await authStore.login()
  } catch (error) {
    if (active) errorMsg.value = error instanceof Error ? error.message : '登录失败，请重试。'
  } finally {
    credentials.password = ''
    pending.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.login-page {
  display: grid;
  min-height: 100vh;
  min-height: 100svh;
  padding: clamp(24px, 4vw, 64px);
  place-items: center;
  color: $color-text-primary;
  background: radial-gradient(ellipse at 12% 12%, #e7effd, transparent 48%), #f3f6fb;
}

.login-frame {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  width: min(1480px, 100%);
  min-height: min(920px, calc(100svh - 128px));
  overflow: hidden;
  background: #fff;
  border: 1px solid #e3eaf4;
  border-radius: 28px;
  box-shadow: 0 24px 80px #19386212;
}

.brand-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(40px, 5vw, 80px);
  color: #fff;
  background: radial-gradient(ellipse at 100% 0, #164b78 0, transparent 62%),
    linear-gradient(145deg, #112c50, #0b162a 75%);
}

.introduction { margin: auto 0; padding: 16px 0 48px; }
.brand-logo { display: block; width: 164px; height: 164px; margin: 0 0 24px -20px; object-fit: contain; }
.eyebrow { margin: 0 0 22px; color: #8dd7ff; font-size: 14px; font-weight: 600; letter-spacing: .24em; }
h1 { margin: 0; font-size: clamp(40px, 3.8vw, 64px); font-weight: 650; line-height: 1.28; letter-spacing: -.035em; }
h1 span { display: block; margin-top: 8px; color: #d7edff; }
.brand-description { margin: 30px 0 0; color: #bdcde1; font-size: 18px; line-height: 1.9; }
.capabilities { display: flex; flex-wrap: wrap; gap: 16px 28px; padding-top: 28px; color: #bdcde1; font-size: 14px; border-top: 1px solid #ffffff24; }
.capabilities span + span { padding-left: 28px; border-left: 1px solid #ffffff30; }
.login-panel { display: grid; padding: 48px clamp(40px, 5vw, 80px); place-items: center; }
.form-column { width: min(480px, 100%); }
.form-eyebrow { margin: 0 0 12px; color: $color-primary; font-size: 16px; font-weight: 600; }
h2 { margin: 0; font-size: 36px; font-weight: 650; line-height: 1.4; letter-spacing: -.025em; }
.subtitle { margin: 14px 0 40px; color: $color-text-secondary; font-size: 16px; line-height: 1.7; }
form { display: grid; gap: 24px; }
.form-field { display: grid; gap: 10px; }
label { color: $color-text-regular; font-size: 16px; font-weight: 550; }
input { box-sizing: border-box; width: 100%; min-width: 0; height: 56px; padding: 0 18px; color: $color-text-primary; font: inherit; font-size: 16px; background: #fbfcfe; border: 1px solid #d4deed; border-radius: 10px; transition: border-color .15s, box-shadow .15s; }
input::placeholder { color: #7b8ba2; }
input:hover:not(:disabled) { border-color: #a8bbd8; }
input:focus { background: #fff; border-color: $color-primary; outline: 3px solid #2563eb20; }
.password-field { position: relative; }
.password-field input { padding-right: 72px; }
.password-toggle { position: absolute; top: 0; right: 6px; height: 56px; padding: 0 14px; color: #526782; font: inherit; font-size: 14px; background: transparent; border: 0; cursor: pointer; }
.submit { height: 56px; margin-top: 10px; color: #fff; font: inherit; font-size: 17px; font-weight: 600; letter-spacing: .12em; background: $color-primary; border: 0; border-radius: 10px; box-shadow: 0 6px 16px #2563eb24; cursor: pointer; transition: background .15s, box-shadow .15s; }
.submit:hover:not(:disabled) { background: $color-primary-dark; box-shadow: 0 8px 20px #2563eb30; }
.submit:disabled { opacity: .65; cursor: wait; }
button:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
.error, .notice { margin: 0 0 24px; padding: 14px 16px; font-size: 14px; line-height: 1.7; overflow-wrap: anywhere; border-radius: 10px; }
.error { color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; }
.notice { color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; }
.help { margin: 32px 0 0; padding-top: 24px; color: $color-text-secondary; font-size: 13px; line-height: 1.9; border-top: 1px solid $color-border-base; }

@media (width <= 1100px) {
  .login-page { padding: 24px; }
  .login-frame { min-height: calc(100svh - 48px); }
  .brand-panel, .login-panel { padding: 40px; }
  h1 { font-size: 42px; }
  .brand-logo { width: 136px; height: 136px; }
  .capabilities { gap: 16px; font-size: 13px; }
  .capabilities span + span { padding-left: 16px; }
}

@media (width <= 860px) {
  .login-page { padding: 0; background: #fff; }
  .login-frame { grid-template-columns: 1fr; min-height: 100svh; border: 0; border-radius: 0; box-shadow: none; }
  .brand-panel { padding: 28px 32px; }
  .introduction { display: grid; grid-template-columns: 88px 1fr; column-gap: 18px; align-items: center; width: min(480px, 100%); margin: 0 auto; padding: 0; }
  .brand-logo { grid-row: 1 / 3; width: 88px; height: 88px; margin: 0; }
  .eyebrow { align-self: end; margin: 0 0 6px; font-size: 11px; }
  h1 { font-size: 27px; line-height: 1.35; }
  h1 span { margin-top: 0; }
  .brand-description, .capabilities { display: none; }
  .login-panel { padding: 32px 28px 36px; align-items: start; }
  .form-eyebrow { font-size: 14px; }
  h2 { font-size: 30px; }
  .subtitle { margin-bottom: 30px; font-size: 15px; }
  form { gap: 18px; }
  .help { margin-top: 24px; padding-top: 20px; }
}

@media (width <= 380px) {
  .brand-panel { padding: 24px 20px; }
  .introduction { grid-template-columns: 76px 1fr; column-gap: 12px; }
  .brand-logo { width: 76px; height: 76px; }
  h1 { font-size: 24px; }
  .login-panel { padding: 32px 20px; }
}
</style>
