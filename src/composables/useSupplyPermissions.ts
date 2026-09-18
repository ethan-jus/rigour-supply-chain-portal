import { useAuthStore } from '@/stores/auth'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'

export function useSupplyPermissions() {
  const auth = useAuthStore()
  const supply = useSupplyAuthorizationStore()
  function can(permission: string, legacyPermission?: string) {
    if (permission.startsWith('supply:') || supply.context?.mode === 'ACTIVE')
      return supply.can(permission)
    return auth.hasPermission(legacyPermission ?? permission)
  }
  return { can }
}
