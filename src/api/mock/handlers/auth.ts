import { registerMock } from '../adapter'

registerMock({
  method: 'POST',
  path: '/auth/login',
  handler: () => ({
    accessToken: 'mock-access-token-' + Date.now(),
    tokenType: 'Bearer',
    expiresIn: 7200,
    refreshToken: 'mock-refresh-token-' + Date.now(),
  }),
})

registerMock({
  method: 'GET',
  path: '/auth/me',
  handler: () => ({
    id: 'u001',
    username: 'admin',
    displayName: '系统管理员',
    avatar: '',
    email: 'admin@rigour.cn',
    phone: '13800138000',
    roles: ['super_admin'],
    permissions: ['*:*:*'],
    tenantId: 'demo',
  }),
})
