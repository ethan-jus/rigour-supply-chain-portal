import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { registerUnauthorizedSessionHandler } from './api'
import { completeOidcCallback } from './auth/oidc'
import { useAuthStore } from './stores'
import { devInfo, devWarn } from './utils/dev-log'
import './assets/styles/index.scss'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

async function bootstrap() {
  let returnPath: string | null = null
  try {
    returnPath = await completeOidcCallback()
  } catch (error) {
    devWarn('门户启动阶段OIDC回调失败，回到登录页', { message: error instanceof Error ? error.message : error })
    window.history.replaceState({}, '', `${import.meta.env.BASE_URL}#/login?reason=oidc_callback_failed`)
  }
  const authStore = useAuthStore(pinia)
  registerUnauthorizedSessionHandler(() => authStore.clearLocalSession())
  authStore.synchronizeTokenState()
  if (returnPath) {
    devInfo('门户准备进入登录前目标页面', { returnPath })
    window.history.replaceState({}, '', `${import.meta.env.BASE_URL}#${returnPath}`)
  }
  app.mount('#app')
}

void bootstrap()
