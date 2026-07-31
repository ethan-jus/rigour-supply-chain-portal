// 扩展 vue-router 的 RouteMeta
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title: string
    icon?: string
    hidden?: boolean
    requiresAuth?: boolean
    roles?: string[]
    permission?: string
    applicationCode?: string
    keepAlive?: boolean
  }
}

export type { RouteMeta } from 'vue-router'
