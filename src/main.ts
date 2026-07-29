import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { setupMockAdapter } from './api/mock'
import { apiClient } from './api'
import { vPermission } from './directives'
import './assets/styles/index.scss'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 注册全局权限指令
app.directive('permission', vPermission)

// 初始化 Mock Adapter（仅在 VITE_ENABLE_MOCK=true 时拦截请求）
setupMockAdapter(apiClient)

app.mount('#app')
