export interface LoginRequest {
  username: string
  password: string
  tenantId?: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  refreshToken?: string
}

export interface UserInfo {
  id: string
  username: string
  displayName: string
  avatar?: string
  email?: string
  phone?: string
  roles: string[]
  permissions: string[]
  tenantId: string
}
