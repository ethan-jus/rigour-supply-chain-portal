import { createRouter, createWebHashHistory } from 'vue-router'
import { constantRoutes, asyncRoutes, notFoundRoute } from './routes'
import { setupPermissionGuard } from './permissionGuard'

/**
 * 在OIDC callback恢复returnPath后创建Router。
 *
 * createWebHashHistory会在创建时缓存当前Hash位置；若模块加载阶段就创建
 * 单例Router，callback之后仅改history地址并不会更新这份缓存，首次导航仍
 * 可能按旧的“/”进入/apps。因此这里必须保留为启动期工厂，而不是模块单例。
 */
export function createPortalRouter() {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [...constantRoutes, ...asyncRoutes, notFoundRoute],
    scrollBehavior: () => ({ top: 0 }),
  })

  setupPermissionGuard(router)
  return router
}

export { constantRoutes, asyncRoutes }
