import { createRouter, createWebHashHistory } from 'vue-router'
import { constantRoutes, asyncRoutes, notFoundRoute } from './routes'
import { setupPermissionGuard } from './permissionGuard'

/**
 * Router 实例
 *
 * 职责：创建 Vue Router 实例，注册全局路由守卫。
 * 使用 Hash 模式避免服务端配置 fallback。
 *
 * 边界：路由定义在 routes.ts；权限逻辑在 permissionGuard.ts。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [...constantRoutes, ...asyncRoutes, notFoundRoute],
  scrollBehavior: () => ({ top: 0 }),
})

setupPermissionGuard(router)

export { constantRoutes, asyncRoutes }

export default router
