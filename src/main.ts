import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { createScdpRouter } from './router'
import { bootstrapScdp } from './bootstrap'
import 'element-plus/es/components/message-box/style/css'
import './assets/styles/index.scss'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
void bootstrapScdp(app, pinia, createScdpRouter)
