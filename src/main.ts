import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { createPortalRouter } from './router'
import { bootstrapPortal } from './bootstrap'
import './assets/styles/index.scss'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
void bootstrapPortal(app, pinia, createPortalRouter)
