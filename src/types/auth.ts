export interface UserInfo {
  id: string
  principalScope: 'TENANT'
  username: string
  displayName: string
  avatar?: string
  email?: string
  phone?: string
  roles: string[]
  permissions: string[]
  tenantId: string | null
  tenantName: string | null
}
