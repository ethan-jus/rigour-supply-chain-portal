import { describe, expect, it, vi } from 'vitest'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'

const accessToken = 'test-access-token'

vi.mock('@/utils/token', () => ({
  getAuthorizationHeader: () => `Bearer ${accessToken}`,
  removeToken: vi.fn(),
}))

import { apiClient } from '@/api'

describe('Portal API认证头', () => {
  it('供应链入口请求统一携带登录后获取的Bearer Token', async () => {
    const response = await apiClient.get('/portal/navigation/SUPPLY_CHAIN', {
      adapter: async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
        const authorization = typeof config.headers?.get === 'function'
          ? config.headers.get('Authorization')
          : config.headers?.Authorization
        expect(authorization).toBe(`Bearer ${accessToken}`)
        return { data: [], status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse
      },
    })

    expect(response).toEqual([])
  })
})
