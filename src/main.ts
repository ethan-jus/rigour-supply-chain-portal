import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { createScdpRouter } from './router'
import { bootstrapScdp } from './bootstrap'
import 'element-plus/es/components/message-box/style/css'
import './assets/styles/index.scss'
import { publishRequestFailure } from '@/utils/request-feedback'

const app = createApp(App)
const pinia = createPinia()
app.config.errorHandler = (error) => {
  console.error('页面操作异常', error instanceof Error ? error.name : 'UnknownError')
  publishRequestFailure({ message: '页面操作发生异常，请重试；若仍失败，请联系管理员。' })
}
window.addEventListener('unhandledrejection', event => publishRequestFailure(event.reason))

app.use(pinia)
void bootstrapScdp(app, pinia, createScdpRouter)
