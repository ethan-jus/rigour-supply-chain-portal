import { createRouter, createWebHashHistory, type Router } from 'vue-router'
import { constantRoutes, notFoundRoute } from './routes'
import { setupPermissionGuard } from './permissionGuard'

let scdpRouter: Router | null = null

/** 菜单数据里的自定义页面需要在同一个 Router 实例上注册动态路由。 */
export function getScdpRouter(): Router | null {
  return scdpRouter
}

/** 回调处理完成后创建路由，首次导航使用已恢复的登录状态。 */
export function createScdpRouter() {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [...constantRoutes, notFoundRoute],
    scrollBehavior: () => ({ top: 0 }),
  })

  setupPermissionGuard(router)
  scdpRouter = router
  return router
}

export { constantRoutes }
