import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { completeOidcCallback } from './auth/oidc'
import { useAuthStore } from './stores'
import { vPermission } from './directives'
import './assets/styles/index.scss'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 注册全局权限指令
app.directive('permission', vPermission)

async function bootstrap() {
  let returnPath: string | null = null
  try {
    returnPath = await completeOidcCallback()
  } catch {
    window.history.replaceState({}, '', `${import.meta.env.BASE_URL}#/login?reason=oidc_callback_failed`)
  }
  const authStore = useAuthStore(pinia)
  authStore.synchronizeTokenState()
  if (returnPath) {
    window.history.replaceState({}, '', `${import.meta.env.BASE_URL}#${returnPath}`)
  }
  app.mount('#app')
}

void bootstrap()
