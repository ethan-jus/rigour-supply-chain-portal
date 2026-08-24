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
    /** 仅校验应用卡片授权，不加载内部路由菜单。 */
    requiredApplicationCode?: string
    keepAlive?: boolean
    dictionaryScope?: 'platform' | 'tenant'
    pageKey?: string
  }
}

export type { RouteMeta } from 'vue-router'
