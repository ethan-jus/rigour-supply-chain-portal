import type { Router } from 'vue-router'
import type { PortalApplication } from '@/types/application'
import { devInfo, devWarn } from '@/utils/dev-log'

const INTERNAL_ROUTES = new Set([
  '/platform-admin', '/system-admin', '/supply-chain', '/supply-chain/dinghuobao',
])

/** 启动IAM已授权卡片；外部窗口不携带Portal Bearer Token。 */
export async function launchApplication(app: PortalApplication, router: Router): Promise<void> {
  devInfo('开始打开门户应用', { code: app.code, launchMode: app.launchMode, targetUri: app.targetUri })
  if (!app.targetUri) throw new Error('应用尚未配置启动地址')
  if (app.launchMode === 'INTERNAL_ROUTE') {
    if (!INTERNAL_ROUTES.has(app.targetUri)) throw new Error('应用内部路由未注册')
    await router.push(app.targetUri)
    const currentPath = router.currentRoute.value.path
    if (currentPath !== app.targetUri) {
      devWarn('门户应用内部路由被权限守卫改写', {
        code: app.code,
        targetUri: app.targetUri,
        currentPath,
      })
      throw new Error('应用入口未打开，请刷新权限后重试')
    }
    devInfo('门户应用内部路由打开成功', { code: app.code, targetUri: app.targetUri })
    return
  }
  if (app.launchMode === 'EXTERNAL_URL') {
    const target = new URL(app.targetUri)
    if (target.protocol !== 'https:') throw new Error('外部应用必须使用HTTPS')
    window.open(target, '_blank', 'noopener,noreferrer')
    devInfo('外部应用已打开', { code: app.code, host: target.host })
    return
  }
  if (app.launchMode === 'OIDC_CLIENT') {
    const target = new URL(app.targetUri)
    const local = import.meta.env.DEV && target.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    if (target.protocol !== 'https:' && !local) throw new Error('OIDC应用必须使用HTTPS或本地loopback地址')
    window.open(target, '_blank', 'noopener,noreferrer')
    devInfo('OIDC应用已打开', { code: app.code, host: target.host })
    return
  }
  throw new Error('该应用的单点启动协议尚未接入')
}
