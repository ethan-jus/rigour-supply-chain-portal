import type { Directive, DirectiveBinding } from 'vue'
import { useAuthStore } from '@/stores'

/**
 * v-permission 指令
 *
 * 职责：根据用户权限控制 DOM 元素的显隐。
 * 用法：v-permission="'erp:sku:list'" 或 v-permission="['erp:sku:list', 'erp:warehouse:list']"
 *
 * 边界：
 * - 仅控制 mounted 时的显隐，不响应权限变化（权限在登录时确定）
 * - 无权限时移除元素（非 display:none），减少 DOM 残留
 *
 * 风险：SSR 环境下 useAuthStore 可能不可用，当前仅用于客户端渲染。
 */
export const vPermission: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
    const authStore = useAuthStore()
    const permissions = Array.isArray(binding.value) ? binding.value : [binding.value]

    const hasPermission = permissions.some((p) => authStore.hasPermission(p))
    if (!hasPermission) {
      el.parentNode?.removeChild(el)
    }
  },
}
